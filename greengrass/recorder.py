#!/usr/bin/env python3
import os
import subprocess
import time
import boto3
import shlex

# 固定設定（保存先 S3 パス）
BUCKET = "recordings-kawasaki-city"
PREFIX = "ras-1"

# 録音デバイス（USBマイク: card 2, device 0）
DEVICE = "plughw:CARD=Microphone,DEV=0"

# 録音パラメータ（このマイクの上限に合わせる）
DURATION_SEC = 10      # 10秒録音
RATE = 48000           # 48kHz
CHANNELS = 1           # モノラル


def main() -> None:
    if not BUCKET or BUCKET.startswith("<"):
        raise RuntimeError("BUCKET を正しいS3バケット名に設定してください")

    os.makedirs("/tmp", exist_ok=True)
    ts = int(time.time() * 1000)
    out_path = f"/tmp/rec-{ts}.flac"

    # ffmpeg で ALSA デバイスから 10秒録音して FLAC 保存
    cmd = (
        f"ffmpeg -hide_banner -y -f alsa -channels {CHANNELS} -ar {RATE} "
        f"-i {shlex.quote(DEVICE)} -t {DURATION_SEC} -c:a flac {shlex.quote(out_path)}"
    )
    print("[recorder]", cmd)
    subprocess.run(cmd, shell=True, check=True)

    # S3 へアップロード
    key = f"{PREFIX.rstrip('/')}/rec-{ts}.flac"
    print(f"[recorder] uploading to s3://{BUCKET}/{key}")
    s3 = boto3.client("s3")
    s3.upload_file(out_path, BUCKET, key)
    print("[recorder] uploaded")

    try:
        os.remove(out_path)
    except Exception:
        pass
    print("[recorder] done")


if __name__ == "__main__":
    main()


