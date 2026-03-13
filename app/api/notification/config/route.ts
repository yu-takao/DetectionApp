import { NextResponse, NextRequest } from "next/server";
import { getDynamoDbClient, getAwsRuntimeConfig } from "@/lib/aws";
import { GetItemCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { verifyAndGetAdmin } from "@/lib/verify-token";

export const revalidate = 0;

const CONFIG_PK = "CONFIG";
const CONFIG_SK = "NOTIFICATION";

/** GET: 通知設定を取得 */
export async function GET() {
  try {
    const { audioTableName } = getAwsRuntimeConfig();
    if (!audioTableName) {
      return NextResponse.json({ error: "AUDIO_TABLE_NAME is not set" }, { status: 500 });
    }

    const ddb = getDynamoDbClient();
    const res = await ddb.send(new GetItemCommand({
      TableName: audioTableName,
      Key: { pk: { S: CONFIG_PK }, sk: { S: CONFIG_SK } },
    }));

    const item = res.Item;
    const config = {
      enabled: item?.enabled?.BOOL ?? false,
      phoneNumbers: item?.phoneNumbers?.L?.map((v) => v.S ?? "") ?? [],
      cooldownMinutes: item?.cooldownMinutes?.N ? Number(item.cooldownMinutes.N) : 5,
      lastSentAt: item?.lastSentAt?.N ? Number(item.lastSentAt.N) : 0,
    };

    return NextResponse.json(config);
  } catch (err: any) {
    console.error("GET /api/notification/config failed", err);
    return NextResponse.json({ error: err?.message ?? "unknown" }, { status: 500 });
  }
}

/** POST: 通知設定を更新 (admin only) */
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("sonic-eye-token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const auth = await verifyAndGetAdmin(token);
    if (!auth?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { audioTableName } = getAwsRuntimeConfig();
    if (!audioTableName) {
      return NextResponse.json({ error: "AUDIO_TABLE_NAME is not set" }, { status: 500 });
    }

    const body = await req.json();
    const enabled = Boolean(body.enabled);
    const phoneNumbers: string[] = (body.phoneNumbers ?? []).filter((p: string) => p.trim());
    const cooldownMinutes = Number(body.cooldownMinutes) || 5;

    const ddb = getDynamoDbClient();
    await ddb.send(new PutItemCommand({
      TableName: audioTableName,
      Item: {
        pk: { S: CONFIG_PK },
        sk: { S: CONFIG_SK },
        enabled: { BOOL: enabled },
        phoneNumbers: { L: phoneNumbers.map((p) => ({ S: p })) },
        cooldownMinutes: { N: String(cooldownMinutes) },
      },
    }));

    return NextResponse.json({ ok: true, enabled, phoneNumbers, cooldownMinutes });
  } catch (err: any) {
    console.error("POST /api/notification/config failed", err);
    return NextResponse.json({ error: err?.message ?? "unknown" }, { status: 500 });
  }
}
