import { NextRequest } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { fromIni } from "@aws-sdk/credential-providers";

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
const FALLBACK_CACHE_TTL_MS = Number(process.env.HEARTBEAT_FALLBACK_CACHE_TTL_MS || "120000");

// 認証ポリシー:
// - 本番(Amplify/SSR=AWS_EXECUTION_ENVあり): デフォルトプロバイダチェーンに委ねる（実行ロール）
// - ローカル: AWS_PROFILE があれば fromIni を使用
const inRuntime = !!process.env.AWS_EXECUTION_ENV;
const useIniProfile = !inRuntime && !!process.env.AWS_PROFILE;

function createDdbClient() {
  return DynamoDBDocumentClient.from(
    new DynamoDBClient({
      region: REGION,
      ...(useIniProfile
        ? { credentials: fromIni({ profile: process.env.AWS_PROFILE || "trust-kawasaki-city-prod" }) }
        : {}),
    })
  );
}

// 簡易メモリキャッシュ（同一コンテナ内での一時フォールバック用）
const heartbeatCache = new Map<string, { payload: HeartbeatResponse; ts: number }>();

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const thingName = searchParams.get("thing") || "kawasaki-1";

  try {
    const ddbClient = createDdbClient();
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

    // 成功時にキャッシュ保存
    heartbeatCache.set(thingName, { payload, ts: nowMs });

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store, no-cache, must-revalidate, max-age=0",
        "x-heartbeat-source": "ddb",
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
          "x-heartbeat-source": "fallback-resource-not-found",
        },
      });
    }

    // まずは ExpiredToken を検知したら 1 回だけクライアントを作り直して即時再試行
    if (message.includes("ExpiredToken")) {
      try {
        // 実行環境に静的AWSクレデンシャルが残っている場合はクリアし、ロール認証へ誘導
        if (inRuntime) {
          try {
            delete (process.env as any).AWS_ACCESS_KEY_ID;
            delete (process.env as any).AWS_SECRET_ACCESS_KEY;
            delete (process.env as any).AWS_SESSION_TOKEN;
          } catch {}
        }

        // 小さな待機の後、新しいクライアントで再試行
        await new Promise((r) => setTimeout(r, 200));
        const fresh = createDdbClient();

        const result = await fresh.send(
          new GetCommand({
            TableName: TABLE_NAME,
            Key: { thingName },
            ConsistentRead: false,
          })
        );

        const nowMs = Date.now();
        let item = (result.Item || {}) as { lastSeen?: unknown; lastTs?: unknown };
        if (!result.Item) {
          try {
            const scan = await fresh.send(
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
        const raw = (item.lastSeen ?? item.lastTs) as unknown;
        let lastSeenNum: number | null = null;
        if (typeof raw === "number") lastSeenNum = raw;
        else if (typeof raw === "string") {
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

        heartbeatCache.set(thingName, { payload, ts: nowMs });
        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: {
            "content-type": "application/json",
            "cache-control": "no-store, no-cache, must-revalidate, max-age=0",
            "x-heartbeat-source": "ddb-retry",
          },
        });
      } catch (retryErr) {
        // リトライ失敗は静かにフォールバックさせる（ログ氾濫防止）
      }
    }

    // フォールバック: 認証・ネットワーク・権限エラー等すべてで 200 を返却
    // 1) キャッシュが一定期間内ならそれを利用（ステータスは現在時刻で再評価）
    const cached = heartbeatCache.get(thingName);
    const nowMs = Date.now();
    if (cached && nowMs - cached.ts <= FALLBACK_CACHE_TTL_MS) {
      const lastSeenMs = cached.payload.lastSeen;
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
          "x-heartbeat-source": "fallback-cache",
        },
      });
    }

    // 2) キャッシュが無い or 期限切れ → Offline として返却
    // ここでのログはノイズになるため、ExpiredToken 系は抑制済み。それ以外のみログ。
    if (!message.includes("ExpiredToken")) {
      // eslint-disable-next-line no-console
      console.error("/api/heartbeat error", err);
    }
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
        "x-heartbeat-source": "fallback-offline",
      },
    });
  }
}


