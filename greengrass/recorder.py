#!/usr/bin/env python3
import os
import json
import time
import shlex
import boto3
import traceback
import subprocess
import awsiot.greengrasscoreipc.clientv2 as clientv2
from awsiot.greengrasscoreipc.model import QOS

# 既定設定（アプリからの設定で上書き可能）
DEFAULTS = {
    "bucket": "recordings-kawasaki-city",
    "prefix": "ras-1",
    "device": "plughw:CARD=Microphone,DEV=0",  # USBマイク (card 2, device 0)
    "durationSec": 10,
    "intervalSec": 0,  # 0 で定期録音無効
    "enabled": False    # 定期録音フラグ
}

# 録音パラメータ固定（マイクの上限）
RATE = 48000
CHANNELS = 1

STATE = {
    "bucket": DEFAULTS["bucket"],
    "prefix": DEFAULTS["prefix"],
    "device": DEFAULTS["device"],
    "durationSec": DEFAULTS["durationSec"],
    "intervalSec": DEFAULTS["intervalSec"],
    "enabled": DEFAULTS["enabled"],
    "thing": None,
}

ipc = clientv2.GreengrassCoreIPCClientV2()
s3 = boto3.client("s3")


def _clamp_int(v, lo, hi, default):
    try:
        n = int(v)
    except Exception:
        return default
    return max(lo, min(hi, n))


def record_once(bucket: str, prefix: str, device: str, duration_sec: int, thing: str | None) -> str:
    os.makedirs("/tmp", exist_ok=True)
    ts = int(time.time() * 1000)
    out_path = f"/tmp/rec-{ts}.flac"
    cmd = (
        f"ffmpeg -hide_banner -y -f alsa -channels {CHANNELS} -ar {RATE} "
        f"-i {shlex.quote(device)} -t {duration_sec} -c:a flac {shlex.quote(out_path)}"
    )
    print("[recorder] ", cmd, flush=True)
    subprocess.run(cmd, shell=True, check=True)

    key = f"{prefix.rstrip('/')}/{(thing or 'unknown')}/rec-{ts}.flac"
    print(f"[recorder] uploading to s3://{bucket}/{key}", flush=True)
    s3.upload_file(out_path, bucket, key)

    try:
        os.remove(out_path)
    except Exception:
        pass
    return key


def publish_ack(thing: str, ok: bool, key: str | None, err: str | None):
    payload = json.dumps({
        "thing": thing,
        "ok": ok,
        "key": key,
        "error": err,
        "ts": int(time.time()*1000)
    }).encode("utf-8")
    try:
        ipc.publish_to_iot_core(topic_name=f"ack/{thing}/record", qos=QOS.AT_LEAST_ONCE, payload=payload)
    except Exception:
        pass


def handle_record(topic: str, payload: dict):
    parts = topic.split("/")
    thing = str(payload.get("thing") or (parts[1] if len(parts) >= 3 else "unknown"))
    bucket = str(payload.get("bucket") or STATE["bucket"])
    prefix = str(payload.get("prefix") or STATE["prefix"]) 
    device = str(payload.get("device") or STATE["device"]) 
    duration = _clamp_int(payload.get("durationSec", STATE["durationSec"]), 1, 300, STATE["durationSec"]) 

    try:
        key = record_once(bucket, prefix, device, duration, thing)
        publish_ack(thing, True, key, None)
    except Exception as e:
        publish_ack(thing, False, None, f"{type(e).__name__}: {e}")


def handle_config(topic: str, payload: dict):
    # 設定更新: { enabled, intervalSec, durationSec, bucket, prefix, device }
    if "enabled" in payload:
        STATE["enabled"] = bool(payload.get("enabled"))
    if "intervalSec" in payload:
        STATE["intervalSec"] = _clamp_int(payload.get("intervalSec"), 0, 86400, STATE["intervalSec"])  # 0=停止
    if "durationSec" in payload:
        STATE["durationSec"] = _clamp_int(payload.get("durationSec"), 1, 300, STATE["durationSec"]) 
    if "bucket" in payload and payload.get("bucket"):
        STATE["bucket"] = str(payload.get("bucket"))
    if "prefix" in payload and payload.get("prefix") is not None:
        STATE["prefix"] = str(payload.get("prefix"))
    if "device" in payload and payload.get("device"):
        STATE["device"] = str(payload.get("device"))
    print("[recorder] config updated:", json.dumps({k: STATE[k] for k in ["enabled","intervalSec","durationSec","bucket","prefix","device"]}), flush=True)


def subscribe_loop():
    def on_msg(event):
        try:
            m = event.message
            if not m or not m.payload:
                return
            topic = m.topic_name or ""
            payload = json.loads(bytes(m.payload).decode("utf-8"))
            if topic.startswith("cmd/") and topic.endswith("/record"):
                handle_record(topic, payload)
            elif topic.startswith("cmd/") and topic.endswith("/record/config"):
                handle_config(topic, payload)
        except Exception as e:
            print(f"[recorder] on_msg error: {e}", flush=True)

    ipc.subscribe_to_iot_core(topic_name="cmd/+/record", qos=QOS.AT_MOST_ONCE, on_stream_event=on_msg)
    ipc.subscribe_to_iot_core(topic_name="cmd/+/record/config", qos=QOS.AT_MOST_ONCE, on_stream_event=on_msg)
    print("[recorder] subscribed: cmd/+/record, cmd/+/record/config", flush=True)

    # 簡易スケジューラ
    next_ts = time.time()
    while True:
        try:
            if STATE["enabled"] and STATE["intervalSec"] > 0:
                now = time.time()
                if now >= next_ts:
                    try:
                        key = record_once(STATE["bucket"], STATE["prefix"], STATE["device"], STATE["durationSec"], STATE.get("thing"))
                        if STATE.get("thing"):
                            publish_ack(STATE["thing"], True, key, None)
                    except Exception as e:
                        if STATE.get("thing"):
                            publish_ack(STATE["thing"], False, None, f"{type(e).__name__}: {e}")
                    next_ts = now + STATE["intervalSec"]
            time.sleep(0.5)
        except Exception as e:
            print(f"[recorder] scheduler error: {e}", flush=True)
            time.sleep(1)


def main():
    try:
        subscribe_loop()
    except Exception:
        traceback.print_exc()


if __name__ == "__main__":
    main()


