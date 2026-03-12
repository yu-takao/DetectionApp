import { NextResponse, NextRequest } from "next/server";
import { getDynamoDbClient, getAwsRuntimeConfig } from "@/lib/aws";
import { GetItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { fromNodeProviderChain } from "@aws-sdk/credential-providers";

export const revalidate = 0;

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "ap-northeast-1";

function getSnsClient() {
  return new SNSClient({
    region: REGION,
    credentials: fromNodeProviderChain(),
  });
}

/**
 * POST: 異音検出時にSMS送信
 * body: { anomalyCount: number, maxError: number, threshold: number }
 *
 * クールダウン期間内なら送信しない。
 * 送信後に lastSentAt を更新。
 */
export async function POST(req: NextRequest) {
  try {
    const { audioTableName } = getAwsRuntimeConfig();
    if (!audioTableName) {
      return NextResponse.json({ error: "AUDIO_TABLE_NAME is not set" }, { status: 500 });
    }

    const body = await req.json();
    const anomalyCount = body.anomalyCount ?? 0;
    const maxError = body.maxError ?? 0;
    const threshold = body.threshold ?? 5.0;

    if (anomalyCount <= 0) {
      return NextResponse.json({ sent: false, reason: "no anomalies" });
    }

    // 通知設定を取得
    const ddb = getDynamoDbClient();
    const cfgRes = await ddb.send(new GetItemCommand({
      TableName: audioTableName,
      Key: { pk: { S: "CONFIG" }, sk: { S: "NOTIFICATION" } },
    }));

    const item = cfgRes.Item;
    if (!item?.enabled?.BOOL) {
      return NextResponse.json({ sent: false, reason: "notifications disabled" });
    }

    const phoneNumbers = item.phoneNumbers?.L?.map((v) => v.S ?? "").filter(Boolean) ?? [];
    if (phoneNumbers.length === 0) {
      return NextResponse.json({ sent: false, reason: "no phone numbers" });
    }

    const cooldownMinutes = item.cooldownMinutes?.N ? Number(item.cooldownMinutes.N) : 5;
    const lastSentAt = item.lastSentAt?.N ? Number(item.lastSentAt.N) : 0;
    const now = Date.now();

    if (now - lastSentAt < cooldownMinutes * 60 * 1000) {
      return NextResponse.json({ sent: false, reason: "cooldown", nextAvailableAt: lastSentAt + cooldownMinutes * 60 * 1000 });
    }

    // SMS送信
    const sns = getSnsClient();
    const message = `【Noise Monitor】異音を${anomalyCount}件検出しました（最大異常度: ${maxError.toFixed(1)} / 閾値: ${threshold.toFixed(1)}）`;

    const results = await Promise.allSettled(
      phoneNumbers.map((phone) =>
        sns.send(new PublishCommand({
          PhoneNumber: phone,
          Message: message,
        }))
      )
    );

    const successCount = results.filter((r) => r.status === "fulfilled").length;

    // lastSentAt を更新
    await ddb.send(new UpdateItemCommand({
      TableName: audioTableName,
      Key: { pk: { S: "CONFIG" }, sk: { S: "NOTIFICATION" } },
      UpdateExpression: "SET lastSentAt = :ts",
      ExpressionAttributeValues: { ":ts": { N: String(now) } },
    }));

    return NextResponse.json({ sent: true, successCount, totalNumbers: phoneNumbers.length });
  } catch (err: any) {
    console.error("POST /api/notification/send failed", err);
    return NextResponse.json({ error: err?.message ?? "unknown" }, { status: 500 });
  }
}
