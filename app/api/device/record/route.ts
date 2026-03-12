import { NextRequest } from "next/server";
import { PublishCommand } from "@aws-sdk/client-iot-data-plane";
import { getIotDataClient } from "@/lib/aws";

type RecordRequest = {
  thing?: string;
  delaySec?: number;
  durationSec?: number;
  ext?: "flac" | "webm" | "wav" | "ogg";
};

const TOPIC_PREFIX = process.env.IOT_TOPIC_PREFIX || "devices";

export async function POST(req: NextRequest) {
  const iotEndpoint = process.env.IOT_DATA_ENDPOINT || process.env.IOT_ENDPOINT || "";
  if (!iotEndpoint) {
    return Response.json({ error: "IOT_ENDPOINT is not configured" }, { status: 500 });
  }

  const body = (await req.json().catch(() => ({}))) as RecordRequest;
  const thing = body.thing || "kawasaki-1";
  const delaySec = Math.max(0, Math.min(60, Number(body.delaySec ?? 5)));
  const durationSec = Math.max(1, Math.min(300, Number(body.durationSec ?? 10)));
  const ext = (body.ext || "flac") as RecordRequest["ext"];

  const topic = `${TOPIC_PREFIX}/${thing}/cmd/record`;
  const payload = JSON.stringify({ delaySec, durationSec, ext, requestedAt: Date.now() });

  try {
    const iot = getIotDataClient();
    await iot.send(
      new PublishCommand({
        topic,
        payload: new TextEncoder().encode(payload),
        qos: 0,
      })
    );
    return Response.json({ ok: true, topic, delaySec, durationSec, ext });
  } catch (err) {
    console.error("/api/device/record error", err);
    return Response.json({ error: "Failed to publish record command" }, { status: 500 });
  }
}
