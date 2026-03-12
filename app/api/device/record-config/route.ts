import { NextRequest, NextResponse } from "next/server";
import { PublishCommand } from "@aws-sdk/client-iot-data-plane";
import { GetItemCommand } from "@aws-sdk/client-dynamodb";
import { getDynamoDbClient, getIotDataClient } from "@/lib/aws";
import { verifyAndGetAdmin } from "@/lib/verify-token";

const CONFIG_TABLE = process.env.RECORDER_CONFIG_TABLE || "RecorderConfig";

// ---- GET: デバイスの現在適用済み設定を DynamoDB から取得 ----

export async function GET(req: NextRequest) {
  const thing = req.nextUrl.searchParams.get("thing") || "kawasaki-ras-1";

  try {
    const ddb = getDynamoDbClient();
    const result = await ddb.send(
      new GetItemCommand({
        TableName: CONFIG_TABLE,
        Key: {
          pk: { S: "RECORDER_CONFIG" },
          sk: { S: thing },
        },
      })
    );

    if (!result.Item) {
      return Response.json({ config: null, message: "No config ACK received yet" });
    }

    const item = result.Item;
    return Response.json({
      config: {
        enabled: item.enabled?.BOOL ?? false,
        intervalSec: Number(item.intervalSec?.N ?? "3600"),
        scheduleStartHour: Number(item.scheduleStartHour?.N ?? "0"),
        scheduleEndHour: Number(item.scheduleEndHour?.N ?? "24"),
        bucket: item.bucket?.S ?? "recordings-kawasaki-city",
        prefix: item.prefix?.S ?? "phase1",
        appliedAt: Number(item.appliedAt?.N ?? "0"),
        thing: item.sk?.S ?? thing,
      },
    });
  } catch (err: any) {
    console.error("/api/device/record-config GET error", err);
    return Response.json({ error: err?.message ?? "Failed to read config from DynamoDB" }, { status: 500 });
  }
}

// ---- POST: MQTT で設定をデバイスに送信 ----

type ConfigRequest = {
  thing?: string;
  enabled?: boolean;
  intervalSec?: number;
  scheduleStartHour?: number;
  scheduleEndHour?: number;
  bucket?: string;
  prefix?: string;
};

export async function POST(req: NextRequest) {
  // Admin only
  const token = req.cookies.get("auth-token")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const auth = await verifyAndGetAdmin(token);
  if (!auth?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const iotEndpoint = process.env.IOT_DATA_ENDPOINT || process.env.IOT_ENDPOINT || "";
  if (!iotEndpoint) {
    return Response.json(
      { error: "IOT_DATA_ENDPOINT is not configured" },
      { status: 500 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as ConfigRequest;
  const thing = body.thing || "kawasaki-ras-1";

  const clamp = (n: unknown, lo: number, hi: number, def: number) => {
    const v = Number(n);
    return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : def;
  };

  const payload: Record<string, unknown> = { thing };

  if (typeof body.enabled === "boolean") payload.enabled = body.enabled;
  if (body.intervalSec != null) payload.intervalSec = clamp(body.intervalSec, 10, 86400, 3600);
  if (body.scheduleStartHour != null) payload.scheduleStartHour = clamp(body.scheduleStartHour, 0, 23, 0);
  if (body.scheduleEndHour != null) payload.scheduleEndHour = clamp(body.scheduleEndHour, 1, 24, 24);
  if (body.bucket) payload.bucket = body.bucket;
  if (body.prefix != null) payload.prefix = body.prefix;

  const topic = `cmd/${thing}/recorder/config`;

  try {
    const iot = getIotDataClient();
    await iot.send(
      new PublishCommand({
        topic,
        qos: 1,
        payload: new TextEncoder().encode(JSON.stringify(payload)),
      })
    );

    return Response.json({
      ok: true,
      topic,
      sentAt: Date.now(),
      config: payload,
    });
  } catch (err: any) {
    console.error("/api/device/record-config POST error", err);
    const detail = [err?.name, err?.message, err?.$metadata?.httpStatusCode].filter(Boolean).join(" | ");
    return Response.json({ error: detail || "Failed to publish config" }, { status: 500 });
  }
}
