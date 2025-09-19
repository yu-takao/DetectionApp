import { NextRequest } from "next/server";
import { IoTDataPlaneClient, PublishCommand } from "@aws-sdk/client-iot-data-plane";
import { fromIni } from "@aws-sdk/credential-providers";

type RecordRequest = {
  thing?: string;
  delaySec?: number;
  durationSec?: number;
  ext?: "flac" | "webm" | "wav" | "ogg";
};

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "ap-northeast-1";
const IOT_ENDPOINT = process.env.IOT_ENDPOINT || "";
const TOPIC_PREFIX = process.env.IOT_TOPIC_PREFIX || "devices";

const inRuntime = !!process.env.AWS_EXECUTION_ENV;
const useIniProfile = !inRuntime && !!process.env.AWS_PROFILE;

const iotClient = new IoTDataPlaneClient({
  region: REGION,
  endpoint: IOT_ENDPOINT ? `https://${IOT_ENDPOINT}` : undefined,
  ...(useIniProfile ? { credentials: fromIni({ profile: process.env.AWS_PROFILE || "trust-kawasaki-city-prod" }) } : {}),
});

export async function POST(req: NextRequest) {
  if (!IOT_ENDPOINT) {
    return new Response(JSON.stringify({ error: "IOT_ENDPOINT is not configured" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  const body = (await req.json().catch(() => ({}))) as RecordRequest;
  const thing = body.thing || "kawasaki-1";
  const delaySec = Math.max(0, Math.min(60, Number(body.delaySec ?? 5)));
  const durationSec = Math.max(1, Math.min(300, Number(body.durationSec ?? 10)));
  const ext = (body.ext || "flac") as RecordRequest["ext"];

  const topic = `${TOPIC_PREFIX}/${thing}/cmd/record`;
  const payload = JSON.stringify({ delaySec, durationSec, ext, requestedAt: Date.now() });

  try {
    await iotClient.send(
      new PublishCommand({
        topic,
        payload: new TextEncoder().encode(payload),
        qos: 0,
      })
    );
    return new Response(JSON.stringify({ ok: true, topic, delaySec, durationSec, ext }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("/api/device/record error", err);
    return new Response(JSON.stringify({ error: "Failed to publish record command" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}


