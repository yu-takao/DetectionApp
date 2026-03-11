"""
クラウド音声異常検知 Lambda

S3にアップロードされた音声ファイル (.wav/.flac) をトリガーに、
TFLiteモデルで推論し、結果をDynamoDB AudioIndexに書き込む。

推論設定（モデルパス・閾値）はDynamoDB AudioIndex の
pk=CONFIG, sk=INFERENCE から読み込む。
"""

import json
import os
import time
import traceback
import urllib.parse

import boto3
import numpy as np

# TFLite
try:
    from ai_edge_litert import interpreter as tflite
except ImportError:
    try:
        import tflite_runtime.interpreter as tflite
    except ImportError:
        import tensorflow.lite as tflite

# 音声処理
import librosa

# ========== 環境変数 ==========
S3_BUCKET = os.environ.get("S3_BUCKET", "recordings-kawasaki-city")
AUDIO_TABLE_NAME = os.environ.get("AUDIO_TABLE_NAME", "AudioIndex")
DEFAULT_MODEL_S3_KEY = os.environ.get("DEFAULT_MODEL_S3_KEY", "models/model-0209.tflite")
DEFAULT_THRESHOLD = float(os.environ.get("DEFAULT_THRESHOLD", "5.0"))
MODEL_BUCKET = os.environ.get("MODEL_BUCKET", "recordings-kawasaki-city")

# メルスペクトログラムパラメータ（学習時と同一）
SAMPLE_RATE = 22050
N_FFT = 4096
HOP_LENGTH = 256
N_MELS = 128
FRAMES = 5

# ========== クライアント ==========
s3 = boto3.client("s3")
ddb = boto3.resource("dynamodb")
table = ddb.Table(AUDIO_TABLE_NAME)

# ========== モデルキャッシュ ==========
_cached_model_key = None
_cached_interpreter = None


def get_inference_config():
    """DynamoDBから推論設定を取得。なければデフォルト値を返す。"""
    try:
        resp = table.get_item(Key={"pk": "CONFIG", "sk": "INFERENCE"})
        item = resp.get("Item", {})
        return {
            "model_s3_key": item.get("modelS3Key", DEFAULT_MODEL_S3_KEY),
            "threshold": float(item.get("anomalyThreshold", DEFAULT_THRESHOLD)),
        }
    except Exception as e:
        print(f"[config] Failed to read config, using defaults: {e}")
        return {
            "model_s3_key": DEFAULT_MODEL_S3_KEY,
            "threshold": DEFAULT_THRESHOLD,
        }


def load_model(model_s3_key):
    """S3からTFLiteモデルを読み込み。同じモデルならキャッシュを再利用。"""
    global _cached_model_key, _cached_interpreter

    if _cached_model_key == model_s3_key and _cached_interpreter is not None:
        print(f"[model] Using cached model: {model_s3_key}")
        return _cached_interpreter

    local_path = f"/tmp/model-{model_s3_key.replace('/', '_')}.tflite"

    print(f"[model] Downloading s3://{MODEL_BUCKET}/{model_s3_key}")
    s3.download_file(MODEL_BUCKET, model_s3_key, local_path)

    interpreter = tflite.Interpreter(model_path=local_path)
    interpreter.allocate_tensors()

    input_details = interpreter.get_input_details()
    output_details = interpreter.get_output_details()
    print(f"[model] Loaded: input={input_details[0]['shape']}, output={output_details[0]['shape']}")

    _cached_model_key = model_s3_key
    _cached_interpreter = interpreter
    return interpreter


def extract_features(audio, sr):
    """メルスペクトログラム特徴量を抽出（学習時と同一処理）。"""
    mel_spec = librosa.feature.melspectrogram(
        y=audio, sr=sr, n_fft=N_FFT, hop_length=HOP_LENGTH, n_mels=N_MELS
    )
    log_mel = librosa.power_to_db(mel_spec, ref=np.max)

    n_time = log_mel.shape[1]
    n_vectors = n_time - FRAMES + 1

    if n_vectors < 1:
        return np.empty((0, N_MELS * FRAMES), dtype=np.float32)

    dims = N_MELS * FRAMES
    features = np.zeros((n_vectors, dims), dtype=np.float32)
    for t in range(FRAMES):
        features[:, N_MELS * t : N_MELS * (t + 1)] = log_mel[:, t : t + n_vectors].T

    return features


def run_inference(interpreter, features):
    """TFLiteモデルで推論実行。"""
    input_details = interpreter.get_input_details()
    output_details = interpreter.get_output_details()

    results = []
    for i in range(features.shape[0]):
        sample = features[i].reshape(1, -1).astype(input_details[0]["dtype"])
        interpreter.set_tensor(input_details[0]["index"], sample)
        interpreter.invoke()
        output = interpreter.get_tensor(output_details[0]["index"])
        results.append(output.flatten())

    return np.array(results)


def write_result_to_ddb(s3_key, bucket, is_anomaly, mse, threshold, inference_time_ms, audio_duration_sec):
    """推論結果をDynamoDB AudioIndexに書き込み（PutItem + 推論フィールド）。"""
    item = {
        "pk": "AUDIO",
        "sk": s3_key,
        "bucket": bucket,
        "isAnomaly": is_anomaly,
        "reconstructionError": round(float(mse), 6),
        "inferenceThreshold": round(float(threshold), 6),
        "inferenceTimestamp": int(time.time() * 1000),
        "inferenceTimeMs": round(inference_time_ms, 2),
        "audioDurationSec": round(audio_duration_sec, 2),
        "inferenceMode": "cloud",
    }

    # lastModified をファイル名のタイムスタンプから抽出
    import re
    match = re.search(r"rec-(\d+)\.", s3_key)
    if match:
        ts = int(match.group(1))
        from datetime import datetime, timezone
        item["lastModified"] = datetime.fromtimestamp(ts / 1000, tz=timezone.utc).isoformat()

    table.put_item(Item=item)
    print(f"[ddb] Written: sk={s3_key}, isAnomaly={is_anomaly}, MSE={mse:.6f}")


def handler(event, context):
    """S3イベントトリガーのLambdaハンドラー。"""
    records = event.get("Records", [])
    print(f"[handler] Processing {len(records)} record(s)")

    # 推論設定を取得
    config = get_inference_config()
    model_s3_key = config["model_s3_key"]
    threshold = config["threshold"]
    print(f"[handler] Config: model={model_s3_key}, threshold={threshold}")

    # モデル読み込み
    interpreter = load_model(model_s3_key)

    results = []

    for record in records:
        s3_info = record.get("s3", {})
        bucket = s3_info.get("bucket", {}).get("name", S3_BUCKET)
        raw_key = s3_info.get("object", {}).get("key", "")
        key = urllib.parse.unquote_plus(raw_key)

        # 対象ファイルのみ処理
        lower_key = key.lower()
        if not (lower_key.endswith(".wav") or lower_key.endswith(".flac")):
            print(f"[handler] Skipping non-audio file: {key}")
            continue

        print(f"[handler] Processing: s3://{bucket}/{key}")
        start_time = time.time()

        try:
            # 1. S3から音声ファイルをダウンロード
            local_path = f"/tmp/{os.path.basename(key)}"
            s3.download_file(bucket, key, local_path)

            # 2. 音声読み込み
            audio, sr = librosa.load(local_path, sr=SAMPLE_RATE, mono=True)
            audio_duration = len(audio) / sr
            print(f"[handler] Audio loaded: {len(audio)} samples, {audio_duration:.2f}s")

            # 3. 特徴抽出
            features = extract_features(audio, sr)
            if features.shape[0] == 0:
                print(f"[handler] No features extracted (audio too short): {key}")
                continue

            # 4. 推論
            output = run_inference(interpreter, features)

            # 5. 異常判定（MSE）
            mse = float(np.mean(np.square(features - output)))
            is_anomaly = mse > threshold
            inference_time_ms = (time.time() - start_time) * 1000

            status = "ANOMALY" if is_anomaly else "NORMAL"
            print(f"[handler] Result: {status}, MSE={mse:.6f}, threshold={threshold}, time={inference_time_ms:.0f}ms")

            # 6. DynamoDBに書き込み
            write_result_to_ddb(key, bucket, is_anomaly, mse, threshold, inference_time_ms, audio_duration)

            results.append({
                "key": key,
                "is_anomaly": is_anomaly,
                "mse": round(mse, 6),
                "threshold": threshold,
            })

        except Exception as e:
            print(f"[handler] Error processing {key}: {e}")
            traceback.print_exc()
        finally:
            # 一時ファイル削除
            try:
                os.remove(local_path)
            except Exception:
                pass

    return {"statusCode": 200, "body": json.dumps({"processed": len(results), "results": results})}
