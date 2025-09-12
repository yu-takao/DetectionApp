import json
import os
import time

from awsiot.greengrasscoreipc.clientv2 import GreengrassCoreIPCClientV2
from awsiot.greengrasscoreipc.model import QOS


def main() -> None:
    thing_name = os.environ.get("GG_THING_NAME", "unknown")
    topic = f"trust/heartbeat/{thing_name}"
    interval = int(os.environ.get("HEARTBEAT_INTERVAL_SEC", "30"))

    client = GreengrassCoreIPCClientV2()
    while True:
        payload = {"thingName": thing_name, "ts": int(time.time()), "status": "alive"}
        client.publish_to_iot_core(
            topic_name=topic,
            qos=QOS.AT_LEAST_ONCE,
            payload=json.dumps(payload).encode("utf-8"),
        )
        time.sleep(interval)


if __name__ == "__main__":
    main()


