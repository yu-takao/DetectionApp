import { NextRequest } from "next/server";
import { IoTDataPlaneClient, PublishCommand } from "@aws-sdk/client-iot-data-plane";
import { fromIni } from "@aws-sdk/credential-providers";

type ConfigRequest = {
  thing?: string;
  enabled?: boolean;
  intervalSec?: number;
  durationSec?: number;
  bucket?: string;
  prefix?: string;
  device?: string;
};

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "ap-northeast-1";
// 優先: IOT_DATA_ENDPOINT（互換: IOT_ENDPOINT）
const DATA_ENDPOINT = process.env.IOT_DATA_ENDPOINT || process.env.IOT_ENDPOINT || "";
const DEFAULT_BUCKET = process.env.RECORD_BUCKET || "recordings-kawasaki-city";
const DEFAULT_PREFIX = process.env.RECORD_PREFIX || "ras-1";

const inRuntime = !!process.env.AWS_EXECUTION_ENV;
const useIniProfile = !inRuntime && !!process.env.AWS_PROFILE;

const iotClient = new IoTDataPlaneClient({
  region: REGION,
  endpoint: DATA_ENDPOINT ? `https://${DATA_ENDPOINT}` : undefined,
  ...(useIniProfile ? { credentials: fromIni({ profile: process.env.AWS_PROFILE || "trust-kawasaki-city-prod" }) } : {}),
});

export async function POST(req: NextRequest) {
  if (!DATA_ENDPOINT) {
    return new Response(JSON.stringify({ error: "IOT_DATA_ENDPOINT (or IOT_ENDPOINT) is not configured" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  const body = (await req.json().catch(() => ({}))) as ConfigRequest;
  const thing = body.thing || "kawasaki-ras-1";

  // clamp helpers
  const clamp = (n: unknown, lo: number, hi: number, def: number) => {
    const v = Number(n);
    if (Number.isFinite(v)) return Math.max(lo, Math.min(hi, v));
    return def;
  };

  // 構成値（提供が無ければ既定を使う）
  const enabled = typeof body.enabled === "boolean" ? body.enabled : undefined;
  const intervalSec = body.intervalSec != null ? clamp(body.intervalSec, 0, 86400, 0) : undefined;
  const durationSec = body.durationSec != null ? clamp(body.durationSec, 1, 300, 10) : undefined;
  const bucket = body.bucket || DEFAULT_BUCKET;
  const prefix = body.prefix ?? DEFAULT_PREFIX;
  const device = body.device; // 省略時はデバイス側の既定を使用

  const topic = `cmd/${thing}/record/config`;
  const payloadObj: Record<string, unknown> = {
    thing,
    bucket,
    prefix,
  };
  if (enabled !== undefined) payloadObj.enabled = enabled;
  if (intervalSec !== undefined) payloadObj.intervalSec = intervalSec;
  if (durationSec !== undefined) payloadObj.durationSec = durationSec;
  if (device) payloadObj.device = device;

  const payload = JSON.stringify(payloadObj);

  try {
    await iotClient.send(
      new PublishCommand({ topic, qos: 1, payload: new TextEncoder().encode(payload) })
    );
    return new Response(JSON.stringify({ ok: true, topic, config: payloadObj }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("/api/device/record-config error", err);
    return new Response(JSON.stringify({ error: "Failed to publish record config" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}


