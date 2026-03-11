#!/usr/bin/env python3
"""
音声異常検知推論コンポーネント

録音完了通知を受信し、TFLiteモデルで推論を実行、結果をIoT Coreに送信する。
"""
import os
import sys
import time
import json
import traceback
import numpy as np
from typing import Optional, Dict, Any, Tuple

import boto3
from botocore.exceptions import ClientError

# Greengrass IPC
import awsiot.greengrasscoreipc.clientv2 as clientv2
from awsiot.greengrasscoreipc.model import (
    SubscriptionResponseMessage,
    QOS,
)

# TFLite（インストールできない場合はダミーモード）
try:
    import tflite_runtime.interpreter as tflite
except ImportError:
    print("[inference] Warning: tflite_runtime not available, using dummy mode")
    tflite = None

# librosa（FLAC/WAV読み込み用）
try:
    import librosa
except ImportError:
    print("[inference] Warning: librosa not available")
    librosa = None

# ========== 設定 ==========
MODEL_S3_BUCKET = os.getenv("MODEL_S3_BUCKET", "")
MODEL_S3_KEY = os.getenv("MODEL_S3_KEY", "")  # 例: models/kawasaki-ras-1/model.tflite
MODEL_LOCAL_PATH = os.getenv("MODEL_LOCAL_PATH", "/tmp/model.tflite")
ANOMALY_THRESHOLD = float(os.getenv("ANOMALY_THRESHOLD", "5.0"))
MQTT_TOPIC = os.getenv("MQTT_TOPIC", "audio/inference/result")
THING_NAME = os.getenv("AWS_IOT_THING_NAME", "unknown")

# メルスペクトログラムパラメータ（学習時と同一）
SAMPLE_RATE = 22050
N_FFT = 4096
HOP_LENGTH = 256
N_MELS = 128
FRAMES = 5

# ========== グローバル変数 ==========
interpreter: Optional[Any] = None
input_details = None
output_details = None
dummy_mode = False
ipc_client: Optional[clientv2.GreengrassCoreIPCClientV2] = None


def download_model() -> bool:
    """S3からモデルをダウンロード"""
    if not MODEL_S3_BUCKET or not MODEL_S3_KEY:
        print("[inference] MODEL_S3_BUCKET or MODEL_S3_KEY not set")
        return False

    try:
        print(f"[inference] Downloading model from s3://{MODEL_S3_BUCKET}/{MODEL_S3_KEY}")
        s3 = boto3.client("s3")
        os.makedirs(os.path.dirname(MODEL_LOCAL_PATH) or "/tmp", exist_ok=True)
        s3.download_file(MODEL_S3_BUCKET, MODEL_S3_KEY, MODEL_LOCAL_PATH)
        print(f"[inference] Model downloaded to {MODEL_LOCAL_PATH}")
        return True
    except ClientError as e:
        print(f"[inference] Failed to download model: {e}")
        return False


def load_model() -> bool:
    """TFLiteモデルを読み込み"""
    global interpreter, input_details, output_details, dummy_mode

    if tflite is None:
        print("[inference] TFLite not available, using dummy mode")
        dummy_mode = True
        return True

    if not os.path.exists(MODEL_LOCAL_PATH):
        print(f"[inference] Model file not found: {MODEL_LOCAL_PATH}")
        dummy_mode = True
        return True

    try:
        interpreter = tflite.Interpreter(model_path=MODEL_LOCAL_PATH)
        interpreter.allocate_tensors()
        input_details = interpreter.get_input_details()
        output_details = interpreter.get_output_details()
        print(f"[inference] Model loaded successfully")
        print(f"[inference]   Input shape: {input_details[0]['shape']}")
        print(f"[inference]   Output shape: {output_details[0]['shape']}")
        dummy_mode = False
        return True
    except Exception as e:
        print(f"[inference] Failed to load model: {e}")
        dummy_mode = True
        return True


def load_audio(filepath: str) -> Tuple[Optional[np.ndarray], Optional[int]]:
    """音声ファイルを読み込み（FLAC/WAV対応）"""
    if librosa is None:
        print("[inference] librosa not available")
        return None, None

    try:
        # librosaは自動的にFLAC/WAV/MP3などを処理
        audio, sr = librosa.load(filepath, sr=SAMPLE_RATE, mono=True)
        print(f"[inference] Loaded audio: {len(audio)} samples at {sr}Hz")
        return audio, sr
    except Exception as e:
        print(f"[inference] Failed to load audio: {e}")
        return None, None


def extract_features(audio: np.ndarray, sr: int) -> np.ndarray:
    """
    メルスペクトログラム特徴量を抽出（学習時と同一処理）

    Returns:
        features: shape (N, 640) where 640 = N_MELS * FRAMES
    """
    # メルスペクトログラム計算
    mel_spec = librosa.feature.melspectrogram(
        y=audio, sr=sr, n_fft=N_FFT, hop_length=HOP_LENGTH, n_mels=N_MELS
    )
    # dBスケールに変換
    log_mel = librosa.power_to_db(mel_spec, ref=np.max)

    # フレーム連結
    n_time_frames = log_mel.shape[1]
    n_features = n_time_frames - FRAMES + 1

    if n_features < 1:
        return np.empty((0, N_MELS * FRAMES), dtype=np.float32)

    dims = N_MELS * FRAMES
    features = np.zeros((n_features, dims), dtype=np.float32)
    for t in range(FRAMES):
        features[:, N_MELS * t : N_MELS * (t + 1)] = log_mel[:, t : t + n_features].T

    return features


def run_inference(features: np.ndarray) -> np.ndarray:
    """推論実行（オートエンコーダー再構成）"""
    global interpreter, input_details, output_details, dummy_mode

    if dummy_mode or interpreter is None:
        # ダミーモード: 入力をそのまま返す + ノイズ
        noise = np.random.normal(0, 0.01, features.shape)
        return features + noise.astype(np.float32)

    results = []
    for i in range(features.shape[0]):
        sample = features[i].reshape(1, -1).astype(input_details[0]['dtype'])
        interpreter.set_tensor(input_details[0]['index'], sample)
        interpreter.invoke()
        output = interpreter.get_tensor(output_details[0]['index'])
        results.append(output.flatten())

    return np.array(results)


def detect_anomaly(input_data: np.ndarray, output_data: np.ndarray) -> Tuple[bool, float]:
    """異常検知判定（MSE計算）"""
    if input_data.shape[0] == 0:
        return False, 0.0

    mse_per_sample = np.mean(np.square(input_data - output_data), axis=1)
    mse = float(np.mean(mse_per_sample))
    is_anomaly = mse > ANOMALY_THRESHOLD

    return is_anomaly, mse


def publish_result(result: Dict[str, Any]) -> None:
    """推論結果をMQTT送信"""
    global ipc_client

    if ipc_client is None:
        print("[inference] IPC client not initialized")
        return

    try:
        payload = json.dumps(result).encode("utf-8")
        ipc_client.publish_to_iot_core(
            topic_name=MQTT_TOPIC,
            qos=QOS.AT_LEAST_ONCE,
            payload=payload
        )
        print(f"[inference] Published result to {MQTT_TOPIC}")
    except Exception as e:
        print(f"[inference] Failed to publish result: {e}")


def process_recording(message: Dict[str, Any]) -> None:
    """録音完了通知を処理"""
    filepath = message.get("filepath")
    s3_key = message.get("s3_key")
    device_serial = message.get("device_serial", "unknown")
    timestamp = message.get("timestamp", int(time.time() * 1000))

    if not filepath:
        print("[inference] No filepath in message")
        return

    if not os.path.exists(filepath):
        print(f"[inference] File not found: {filepath}")
        return

    print(f"[inference] Processing: {filepath}")
    start_time = time.time()

    try:
        # 1. 音声読み込み
        audio, sr = load_audio(filepath)
        if audio is None:
            print("[inference] Failed to load audio")
            return

        # 2. 特徴抽出
        features = extract_features(audio, sr)
        if features.shape[0] == 0:
            print("[inference] No features extracted (audio too short)")
            return

        # 3. 推論実行
        output = run_inference(features)

        # 4. 異常判定
        is_anomaly, mse = detect_anomaly(features, output)

        inference_time_ms = (time.time() - start_time) * 1000

        # 5. 結果送信
        result = {
            "event_type": "anomaly_detection_result",
            "device_serial": device_serial,
            "thing_name": THING_NAME,
            "s3_key": s3_key,
            "timestamp": timestamp,
            "is_anomaly": is_anomaly,
            "reconstruction_error": round(mse, 6),
            "threshold": ANOMALY_THRESHOLD,
            "inference_time_ms": round(inference_time_ms, 2),
            "num_samples": features.shape[0],
            "audio_duration_sec": round(len(audio) / SAMPLE_RATE, 2),
        }

        status = "ANOMALY" if is_anomaly else "NORMAL"
        print(f"[inference] Result: {status}, MSE={mse:.4f}, threshold={ANOMALY_THRESHOLD}")

        publish_result(result)

    except Exception as e:
        print(f"[inference] Error processing recording: {e}")
        traceback.print_exc()
    finally:
        # ファイル削除
        try:
            os.remove(filepath)
            print(f"[inference] Deleted: {filepath}")
        except Exception:
            pass


def on_stream_event(event: SubscriptionResponseMessage) -> None:
    """ローカルIPC メッセージ受信コールバック"""
    try:
        if event.json_message is None:
            return
        message = event.json_message.message
        process_recording(message)
    except Exception as e:
        print(f"[inference] Error in callback: {e}")
        traceback.print_exc()


def main():
    global ipc_client

    print("=" * 60)
    print("[inference] Audio Inference Component Starting")
    print(f"[inference] Thing Name: {THING_NAME}")
    print(f"[inference] Anomaly Threshold: {ANOMALY_THRESHOLD}")
    print(f"[inference] MQTT Topic: {MQTT_TOPIC}")
    print("=" * 60)

    # モデルダウンロード
    if MODEL_S3_BUCKET and MODEL_S3_KEY:
        if not os.path.exists(MODEL_LOCAL_PATH):
            download_model()

    # モデル読み込み
    load_model()

    if dummy_mode:
        print("[inference] WARNING: Running in DUMMY MODE")

    # IPC クライアント初期化
    try:
        ipc_client = clientv2.GreengrassCoreIPCClientV2()
        print("[inference] IPC client initialized")
    except Exception as e:
        print(f"[inference] Failed to initialize IPC client: {e}")
        sys.exit(1)

    # ローカルトピック購読
    try:
        ipc_client.subscribe_to_topic(
            topic="audio/recording/ready",
            on_stream_event=on_stream_event,
        )
        print("[inference] Subscribed to: audio/recording/ready")
    except Exception as e:
        print(f"[inference] Failed to subscribe: {e}")
        sys.exit(1)

    print("[inference] Waiting for recording notifications...")

    # メインループ
    try:
        while True:
            time.sleep(10)
    except KeyboardInterrupt:
        print("[inference] Interrupted")


if __name__ == "__main__":
    main()
