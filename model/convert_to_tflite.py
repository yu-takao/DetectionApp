#!/usr/bin/env python3
"""
OtoMoni - Keras モデルを TensorFlow Lite 形式に変換

使用方法:
    python convert_to_tflite.py

このスクリプトは saved_model/AIModelName.keras を読み込み、
TensorFlow Lite 形式に変換して saved_model/anomaly_detector.tflite として保存します。
"""

import os
import sys
import numpy as np

# TensorFlow のログレベルを設定
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'

import tensorflow as tf

# パス設定
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(SCRIPT_DIR, 'saved_model')
KERAS_MODEL_PATH = os.path.join(MODEL_DIR, 'AIModelName.keras')
TFLITE_MODEL_PATH = os.path.join(MODEL_DIR, 'anomaly_detector.tflite')

# モデルパラメータ（検証用）
INPUT_DIMS = 640  # N_MELS(128) * FRAMES(5)


def convert_keras_to_tflite():
    """Keras モデルを TensorFlow Lite 形式に変換"""
    
    print("=" * 60)
    print("OtoMoni - モデル変換 (Keras → TensorFlow Lite)")
    print("=" * 60)
    
    # 1. Keras モデルを読み込み
    print(f"\n[1/4] Keras モデルを読み込み中...")
    print(f"      パス: {KERAS_MODEL_PATH}")
    
    if not os.path.exists(KERAS_MODEL_PATH):
        print(f"エラー: モデルファイルが見つかりません: {KERAS_MODEL_PATH}")
        sys.exit(1)
    
    model = tf.keras.models.load_model(KERAS_MODEL_PATH)
    print(f"      入力形状: {model.input_shape}")
    print(f"      出力形状: {model.output_shape}")
    print("      ✓ 読み込み完了")
    
    # 2. モデル構造を確認
    print(f"\n[2/4] モデル構造を確認中...")
    model.summary()
    
    # 3. TensorFlow Lite Converter を設定
    print(f"\n[3/4] TensorFlow Lite 形式に変換中...")
    
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    
    # 最適化オプション（サイズ削減と高速化）
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    
    # 量子化（オプション - さらに軽量化したい場合）
    # converter.target_spec.supported_types = [tf.float16]
    
    # 変換実行
    tflite_model = converter.convert()
    
    print(f"      変換後サイズ: {len(tflite_model) / 1024:.1f} KB")
    print("      ✓ 変換完了")
    
    # 4. TFLite モデルを保存
    print(f"\n[4/4] TFLite モデルを保存中...")
    print(f"      パス: {TFLITE_MODEL_PATH}")
    
    with open(TFLITE_MODEL_PATH, 'wb') as f:
        f.write(tflite_model)
    
    print("      ✓ 保存完了")
    
    # 5. 変換後のモデルを検証
    print(f"\n[検証] 変換後モデルのテスト...")
    verify_tflite_model(TFLITE_MODEL_PATH)
    
    print("\n" + "=" * 60)
    print("変換が正常に完了しました！")
    print(f"出力ファイル: {TFLITE_MODEL_PATH}")
    print("=" * 60)
    
    return TFLITE_MODEL_PATH


def verify_tflite_model(tflite_path: str):
    """TFLite モデルが正しく動作するか検証"""
    
    # TFLite インタープリターを初期化
    interpreter = tf.lite.Interpreter(model_path=tflite_path)
    interpreter.allocate_tensors()
    
    # 入出力テンソル情報を取得
    input_details = interpreter.get_input_details()
    output_details = interpreter.get_output_details()
    
    print(f"      入力テンソル: {input_details[0]['shape']} ({input_details[0]['dtype']})")
    print(f"      出力テンソル: {output_details[0]['shape']} ({output_details[0]['dtype']})")
    
    # ダミーデータで推論テスト
    dummy_input = np.random.randn(1, INPUT_DIMS).astype(np.float32)
    interpreter.set_tensor(input_details[0]['index'], dummy_input)
    interpreter.invoke()
    output = interpreter.get_tensor(output_details[0]['index'])
    
    # 再構成誤差を計算
    mse = np.mean(np.square(dummy_input - output))
    print(f"      テスト推論: 再構成誤差 = {mse:.4f}")
    print("      ✓ 検証完了")


def compare_models():
    """元のKerasモデルと変換後のTFLiteモデルの出力を比較"""
    
    print("\n[比較検証] Keras vs TFLite モデル出力比較...")
    
    # Keras モデルを読み込み
    keras_model = tf.keras.models.load_model(KERAS_MODEL_PATH)
    
    # TFLite モデルを読み込み
    interpreter = tf.lite.Interpreter(model_path=TFLITE_MODEL_PATH)
    interpreter.allocate_tensors()
    input_details = interpreter.get_input_details()
    output_details = interpreter.get_output_details()
    
    # テストデータを生成
    test_input = np.random.randn(1, INPUT_DIMS).astype(np.float32)
    
    # Keras で推論
    keras_output = keras_model.predict(test_input, verbose=0)
    
    # TFLite で推論
    interpreter.set_tensor(input_details[0]['index'], test_input)
    interpreter.invoke()
    tflite_output = interpreter.get_tensor(output_details[0]['index'])
    
    # 出力を比較
    diff = np.abs(keras_output - tflite_output)
    max_diff = np.max(diff)
    mean_diff = np.mean(diff)
    
    print(f"      最大差異: {max_diff:.8f}")
    print(f"      平均差異: {mean_diff:.8f}")
    
    if max_diff < 1e-5:
        print("      ✓ 出力が一致しています（差異は許容範囲内）")
    else:
        print("      ⚠ 出力に差異があります（量子化による影響の可能性）")


if __name__ == '__main__':
    # 変換を実行
    tflite_path = convert_keras_to_tflite()
    
    # 比較検証
    compare_models()
    
    print("\n次のステップ:")
    print(f"  1. TFLite モデルを S3 にアップロード:")
    print(f"     aws s3 cp {tflite_path} s3://recordings-kawasaki-city/models/anomaly_detector.tflite")
    print(f"  2. Lambda 関数をデプロイ")






