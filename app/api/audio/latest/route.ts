import { NextResponse } from "next/server";
import { getDynamoDbClient, getS3Client, getAwsRuntimeConfig, GetObjectCommand } from "@/lib/aws";
import { QueryCommand, GetItemCommand, BatchGetItemCommand } from "@aws-sdk/client-dynamodb";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const revalidate = 0;

/**
 * GET: 最新の録音データ一覧を返す
 *
 * DDB スキーマ:
 *   AUDIO レコード:   pk="AUDIO",  sk="<timestamp>"  → 音声メタデータ
 *   RESULT レコード:  pk="RESULT#<model_s3_key>", sk="<timestamp>" → モデル別推論結果
 *   CONFIG レコード:  pk="CONFIG", sk="INFERENCE"     → 現在の推論設定
 */
export async function GET() {
  try {
    const { audioTableName, bucketName } = getAwsRuntimeConfig();
    if (!audioTableName) {
      return NextResponse.json({ error: "AUDIO_TABLE_NAME is not set" }, { status: 500 });
    }

    const ddb = getDynamoDbClient();
    const s3 = getS3Client();

    // 1. 現在のモデル設定を取得
    let currentModel = "models/model-0209.tflite";
    try {
      const cfgRes = await ddb.send(new GetItemCommand({
        TableName: audioTableName,
        Key: { pk: { S: "CONFIG" }, sk: { S: "INFERENCE" } },
      }));
      if (cfgRes.Item?.modelS3Key?.S) {
        currentModel = cfgRes.Item.modelS3Key.S;
      }
    } catch (e) {
      console.warn("[AUDIO] Config read failed, using default model", e);
    }

    // 2. AUDIO レコードを最新10件取得 (sk 降順)
    const queryRes = await ddb.send(new QueryCommand({
      TableName: audioTableName,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": { S: "AUDIO" } },
      ScanIndexForward: false,
      Limit: 10,
    }));

    // 旧スキーマ (sk=S3キー) のレコードを除外し、新スキーマ (sk=timestamp) のみ使用
    const audioItems = (queryRes.Items ?? []).filter((item) => {
      const sk = item.sk?.S;
      return sk && /^\d+$/.test(sk);
    });
    if (audioItems.length === 0) {
      return NextResponse.json({ items: [], currentModel });
    }

    // 3. 現在のモデルの RESULT レコードを一括取得
    const resultKeys = audioItems.map((item) => ({
      pk: { S: `RESULT#${currentModel}` },
      sk: item.sk!,
    }));

    let resultMap: Record<string, {
      isAnomaly?: boolean;
      reconstructionError?: number;
      inferenceThreshold?: number;
      inferenceTimestamp?: number;
    }> = {};

    try {
      const batchRes = await ddb.send(new BatchGetItemCommand({
        RequestItems: {
          [audioTableName]: { Keys: resultKeys },
        },
      }));

      for (const item of batchRes.Responses?.[audioTableName] ?? []) {
        const sk = item.sk?.S;
        if (!sk) continue;
        resultMap[sk] = {
          isAnomaly: item.isAnomaly?.BOOL,
          reconstructionError: item.reconstructionError?.N ? Number(item.reconstructionError.N) : undefined,
          inferenceThreshold: item.inferenceThreshold?.N ? Number(item.inferenceThreshold.N) : undefined,
          inferenceTimestamp: item.inferenceTimestamp?.N ? Number(item.inferenceTimestamp.N) : undefined,
        };
      }
    } catch (e) {
      console.warn("[AUDIO] RESULT batch get failed", e);
    }

    // 4. 署名付き URL 生成 + 推論結果マージ
    const defaultBucket = bucketName || "recordings-kawasaki-city";

    const items = await Promise.all(
      audioItems.map(async (item) => {
        const ts = item.sk!.S!;
        const s3Key = item.s3Key?.S ?? "";
        const bucket = item.bucket?.S ?? defaultBucket;

        const lastModified = new Date(parseInt(ts, 10)).toISOString();

        const signed = await getSignedUrl(
          s3,
          new GetObjectCommand({ Bucket: bucket, Key: s3Key, ResponseContentType: "audio/wav" }),
          { expiresIn: 60 * 5 }
        );

        const result = resultMap[ts];

        return {
          key: s3Key,
          url: signed,
          size: item.size?.N ? Number(item.size.N) : undefined,
          lastModified,
          isAnomaly: result?.isAnomaly,
          reconstructionError: result?.reconstructionError,
          inferenceThreshold: result?.inferenceThreshold,
          inferenceTimestamp: result?.inferenceTimestamp,
        };
      })
    );

    return NextResponse.json({ items, currentModel });
  } catch (err: any) {
    console.error("GET /api/audio/latest failed", {
      message: err?.message,
      name: err?.name,
      stack: err?.stack,
    });
    return NextResponse.json({ error: err?.message ?? "unknown" }, { status: 500 });
  }
}
