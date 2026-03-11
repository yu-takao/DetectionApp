#!/usr/bin/env python3
"""scheduled_recorder v1.3.0
MQTT で設定を受信し、スケジュールに従って録音・S3 アップロードを行う。
設定適用後は ACK を MQTT で返す。
"""
import json
import os
import threading
import time
import shlex
import subprocess
from datetime import datetime, timezone, timedelta

import boto3

try:
    from awsiot.greengrasscoreipc.clientv2 import GreengrassCoreIPCClientV2
except ImportError:
    # awsiotsdk[greengrassipc] が必要
    import subprocess as _sp
    _sp.run(["python3", "-m", "pip", "install", "-q", "awsiotsdk"], check=True)
    from awsiot.greengrasscoreipc.clientv2 import GreengrassCoreIPCClientV2

# ---- 固定設定 ----
BUCKET = "recordings-kawasaki-city"
PREFIX = "phase1"
DEVICE = "plughw:CARD=Microphone,DEV=0"
DURATION_SEC = 10
RATE = 48000
CHANNELS = 1  # モノラル固定
ALSA_MIC_VOLUME = 40

# ---- 動的設定（MQTT で上書き可能） ----
config = {
    "enabled": False,
    "intervalSec": 3600,
    "scheduleStartHour": 0,   # JST
    "scheduleEndHour": 24,    # JST
    "bucket": BUCKET,
    "prefix": PREFIX,
}
config_lock = threading.Lock()

JST = timezone(timedelta(hours=9))
THING = os.getenv("AWS_IOT_THING_NAME", "unknown")
CONFIG_TOPIC = f"cmd/{THING}/recorder/config"
ACK_TOPIC = f"status/{THING}/recorder/config"

s3 = boto3.client("s3")
ipc_client: GreengrassCoreIPCClientV2 = None


def publish_ack(applied_config: dict):
    """適用済み設定を ACK トピックに publish する。"""
    try:
        payload = json.dumps({
            "thing": THING,
            "appliedAt": int(time.time() * 1000),
            **applied_config,
        })
        ipc_client.publish_to_iot_core(
            topic_name=ACK_TOPIC,
            qos="1",
            payload=payload.encode("utf-8"),
        )
        print(f"[recorder] ACK published to {ACK_TOPIC}", flush=True)
    except Exception as e:
        print(f"[recorder] ACK publish error: {e}", flush=True)


def on_config_message(event):
    """MQTT 設定メッセージのハンドラ。"""
    try:
        msg = event.message
        payload = json.loads(msg.payload.decode("utf-8"))
        print(f"[recorder] config received: {payload}", flush=True)

        with config_lock:
            if "enabled" in payload and isinstance(payload["enabled"], bool):
                config["enabled"] = payload["enabled"]
            if "intervalSec" in payload:
                config["intervalSec"] = max(10, min(86400, int(payload["intervalSec"])))
            if "scheduleStartHour" in payload:
                config["scheduleStartHour"] = max(0, min(23, int(payload["scheduleStartHour"])))
            if "scheduleEndHour" in payload:
                config["scheduleEndHour"] = max(1, min(24, int(payload["scheduleEndHour"])))
            if "bucket" in payload and isinstance(payload["bucket"], str) and payload["bucket"]:
                config["bucket"] = payload["bucket"]
            if "prefix" in payload and isinstance(payload["prefix"], str):
                config["prefix"] = payload["prefix"]

            applied = dict(config)

        print(f"[recorder] config applied: {applied}", flush=True)
        publish_ack(applied)

    except Exception as e:
        print(f"[recorder] config parse error: {e}", flush=True)


def subscribe_config():
    """Greengrass IPC 経由で IoT Core トピックを subscribe する。"""
    global ipc_client
    ipc_client = GreengrassCoreIPCClientV2()

    ipc_client.subscribe_to_iot_core(
        topic_name=CONFIG_TOPIC,
        qos="1",
        on_stream_event=on_config_message,
    )
    print(f"[recorder] subscribed to {CONFIG_TOPIC}", flush=True)

    # 起動時に現在設定を ACK として publish（フロントが初期状態を取得できるように）
    with config_lock:
        applied = dict(config)
    publish_ack(applied)


def is_in_schedule() -> bool:
    """現在時刻(JST)がスケジュール範囲内か判定。"""
    now_jst = datetime.now(JST)
    hour = now_jst.hour
    with config_lock:
        start = config["scheduleStartHour"]
        end = config["scheduleEndHour"]
    if start < end:
        return start <= hour < end
    elif start > end:
        # 例: 22時〜6時のような日跨ぎ
        return hour >= start or hour < end
    else:
        return False


def set_alsa_mic_volume():
    """ALSA マイクボリュームを設定。"""
    try:
        card = DEVICE.split("CARD=")[1].split(",")[0] if "CARD=" in DEVICE else "0"
        cmd = f"amixer -c {shlex.quote(card)} set Mic {ALSA_MIC_VOLUME}"
        print(f"[recorder] setting ALSA mic volume: {cmd}", flush=True)
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        if result.returncode == 0:
            print(f"[recorder] ALSA mic volume set to {ALSA_MIC_VOLUME}/62", flush=True)
        else:
            print(f"[recorder] Failed to set mic volume: {result.stderr}", flush=True)
    except Exception as e:
        print(f"[recorder] ALSA volume error: {e}", flush=True)


def record_once() -> str:
    """ffmpeg で録音 → S3 アップロード → ローカル削除。"""
    with config_lock:
        bucket = config["bucket"]
        prefix = config["prefix"]

    os.makedirs("/tmp", exist_ok=True)
    ts_ms = int(time.time() * 1000)
    out_path = f"/tmp/rec-{ts_ms}.wav"

    cmd = (
        f"ffmpeg -hide_banner -nostdin -loglevel warning -y "
        f"-thread_queue_size 2048 "
        f"-f alsa -ar {RATE} "
        f"-i {shlex.quote(DEVICE)} -t {DURATION_SEC} "
        f"-ac {CHANNELS} -c:a pcm_s16le {shlex.quote(out_path)}"
    )

    print(f"[recorder] start: {cmd}", flush=True)
    subprocess.run(cmd, shell=True, check=True)

    key = f"{prefix.rstrip('/')}/{THING}/rec-{ts_ms}.wav"
    print(f"[recorder] uploading to s3://{bucket}/{key}", flush=True)
    s3.upload_file(out_path, bucket, key)

    try:
        os.remove(out_path)
    except Exception:
        pass

    print(f"[recorder] done: s3://{bucket}/{key}", flush=True)
    return key


def main():
    print(f"[recorder] scheduled_recorder v1.3.0 starting. thing={THING}", flush=True)

    set_alsa_mic_volume()
    subscribe_config()

    next_ts = time.time()

    while True:
        try:
            now = time.time()

            with config_lock:
                enabled = config["enabled"]
                interval = config["intervalSec"]

            if not enabled:
                time.sleep(1)
                continue

            if not is_in_schedule():
                time.sleep(10)
                continue

            if now >= next_ts:
                try:
                    record_once()
                except subprocess.CalledProcessError as e:
                    print(f"[recorder] ffmpeg error: {e}", flush=True)
                except Exception as e:
                    print(f"[recorder] error: {type(e).__name__}: {e}", flush=True)
                finally:
                    next_ts = now + interval

            time.sleep(0.5)
        except Exception as e:
            print(f"[recorder] loop error: {type(e).__name__}: {e}", flush=True)
            time.sleep(2)


if __name__ == "__main__":
    main()
