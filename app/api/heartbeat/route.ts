import { NextRequest } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { fromIni, fromTokenFile } from "@aws-sdk/credential-providers";

type HeartbeatResponse = {
  thingName: string;
  lastSeen: number | null;
  status: "Active" | "Offline";
  now: number;
  thresholdSec: number;
};

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "ap-northeast-1";
const TABLE_NAME = process.env.HEARTBEAT_TABLE || "device_status";
const ACTIVE_THRESHOLD_SEC = Number(process.env.HEARTBEAT_ACTIVE_THRESHOLD_SEC || "90");

// 認証ポリシー:
// - 本番(Amplify/SSR=AWS_EXECUTION_ENVあり): WebIdentity(実行ロール)を優先し、環境変数の古い一時キーを無視
// - ローカル: AWS_PROFILE があれば fromIni を使用
const inRuntime = !!process.env.AWS_EXECUTION_ENV;
const useIniProfile = !inRuntime && !!process.env.AWS_PROFILE;

const ddbClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    region: REGION,
    ...(inRuntime
      ? { credentials: fromTokenFile() }
      : useIniProfile
      ? { credentials: fromIni({ profile: process.env.AWS_PROFILE || "trust-kawasaki-city-prod" }) }
      : {}),
  })
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const thingName = searchParams.get("thing") || "kawasaki-1";

  try {
    const result = await ddbClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { thingName },
        ConsistentRead: false,
      })
    );

    const nowMs = Date.now();
    let item = (result.Item || {}) as { lastSeen?: unknown; lastTs?: unknown };

    // Fallback: 稀に整合性遅延等でGet未取得の場合、Scanで補完（小規模テーブル前提）
    if (!result.Item) {
      try {
        const scan = await ddbClient.send(
          new ScanCommand({
            TableName: TABLE_NAME,
            Limit: 5,
            FilterExpression: "thingName = :t",
            ExpressionAttributeValues: { ":t": thingName },
          })
        );
        if (scan.Items && scan.Items.length > 0) {
          item = scan.Items[0] as typeof item;
        }
      } catch {}
    }
    // lastSeen または後方互換で lastTs を参照
    const raw = (item.lastSeen ?? item.lastTs) as unknown;
    let lastSeenNum: number | null = null;
    if (typeof raw === "number") {
      lastSeenNum = raw;
    } else if (typeof raw === "string") {
      const n = Number(raw);
      if (!Number.isNaN(n)) lastSeenNum = n;
    }
    const lastSeenMs = lastSeenNum != null
      ? (lastSeenNum > 1_000_000_000_000 ? lastSeenNum : lastSeenNum * 1000)
      : null;

    const isActive = !!lastSeenMs && (nowMs - lastSeenMs) <= ACTIVE_THRESHOLD_SEC * 1000;

    const payload: HeartbeatResponse = {
      thingName,
      lastSeen: lastSeenMs ?? null,
      status: isActive ? "Active" : "Offline",
      now: nowMs,
      thresholdSec: ACTIVE_THRESHOLD_SEC,
    };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    });
  } catch (err: unknown) {
    const asAny = err as any;
    const message = String(asAny?.name || asAny?.__type || asAny || "");

    if (message.includes("ResourceNotFoundException")) {
      // テーブル未作成などの場合はオフライン扱いで返す（UIを落とさない）
      const nowMs = Date.now();
      const payload: HeartbeatResponse = {
        thingName,
        lastSeen: null,
        status: "Offline",
        now: nowMs,
        thresholdSec: ACTIVE_THRESHOLD_SEC,
      };
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: {
          "content-type": "application/json",
          "cache-control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      });
    }

    // サーバーログにも出す
    // eslint-disable-next-line no-console
    console.error("/api/heartbeat error", err);
    return new Response(
      JSON.stringify({ error: "Failed to query heartbeat" }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
}


