import { NextRequest, NextResponse } from "next/server";
import { getDynamoDbClient, getS3Client, getAwsRuntimeConfig, GetObjectCommand } from "@/lib/aws";
import { QueryCommand, GetItemCommand, BatchGetItemCommand } from "@aws-sdk/client-dynamodb";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const revalidate = 0;

/**
 * GET: 録音データ一覧を返す
 *
 * Query params:
 *   limit  - 1ページの件数 (default 20, max 100)
 *   cursor - ページネーション用カーソル (前回の nextCursor)
 *   from   - 開始タイムスタンプ (epoch ms)
 *   to     - 終了タイムスタンプ (epoch ms)
 *   chart  - "1" の場合、署名付きURLをスキップし全件取得（チャート用）
 */
export async function GET(req: NextRequest) {
  try {
    const { audioTableName, bucketName } = getAwsRuntimeConfig();
    if (!audioTableName) {
      return NextResponse.json({ error: "AUDIO_TABLE_NAME is not set" }, { status: 500 });
    }

    const params = req.nextUrl.searchParams;
    const chartMode = params.get("chart") === "1";
    const limit = chartMode
      ? undefined // チャートモードではLimitを指定せず全件取得
      : Math.min(Math.max(parseInt(params.get("limit") || "20", 10) || 20, 1), 100);
    const cursor = params.get("cursor") || undefined;
    const fromTs = params.get("from") || "1000000000000";
    const toTs = params.get("to") || "1999999999999";

    const ddb = getDynamoDbClient();

    // 1. 現在のモデル設定 + 閾値を取得
    let currentModel = "models/model-0209.tflite";
    let currentThreshold = 5.0;
    try {
      const cfgRes = await ddb.send(new GetItemCommand({
        TableName: audioTableName,
        Key: { pk: { S: "CONFIG" }, sk: { S: "INFERENCE" } },
      }));
      if (cfgRes.Item?.modelS3Key?.S) {
        currentModel = cfgRes.Item.modelS3Key.S;
      }
      if (cfgRes.Item?.anomalyThreshold?.N) {
        currentThreshold = Number(cfgRes.Item.anomalyThreshold.N);
      }
    } catch (e) {
      console.warn("[AUDIO] Config read failed, using defaults", e);
    }

    // 2. AUDIO レコードを取得 (sk 降順)
    // チャートモードではページネーションで全件取得
    let audioItems: Record<string, any>[] = [];
    let exclusiveStartKey = cursor
      ? { pk: { S: "AUDIO" }, sk: { S: cursor } }
      : undefined;

    do {
      const queryParams: any = {
        TableName: audioTableName,
        KeyConditionExpression: "pk = :pk AND sk BETWEEN :skMin AND :skMax",
        ExpressionAttributeValues: {
          ":pk": { S: "AUDIO" },
          ":skMin": { S: fromTs },
          ":skMax": { S: toTs },
        },
        ScanIndexForward: false,
      };
      if (limit !== undefined) queryParams.Limit = limit;
      if (exclusiveStartKey) queryParams.ExclusiveStartKey = exclusiveStartKey;

      const queryRes = await ddb.send(new QueryCommand(queryParams));
      audioItems = audioItems.concat(queryRes.Items ?? []);
      exclusiveStartKey = queryRes.LastEvaluatedKey as any;

      // 通常モードではページネーションせず1回で返す
      if (!chartMode) {
        const nextCursor = queryRes.LastEvaluatedKey?.sk?.S || null;
        // 通常モードは以降の処理へ（audioItemsは1ページ分）
        return await buildResponse(audioItems, nextCursor, currentModel, currentThreshold, audioTableName, bucketName, ddb, false);
      }
    } while (exclusiveStartKey);

    // チャートモード: 全件取得済み
    return await buildResponse(audioItems, null, currentModel, currentThreshold, audioTableName, bucketName, ddb, true);
  } catch (err: any) {
    console.error("GET /api/audio/latest failed", {
      message: err?.message,
      name: err?.name,
      stack: err?.stack,
    });
    return NextResponse.json({ error: err?.message ?? "unknown" }, { status: 500 });
  }
}

async function buildResponse(
  audioItems: Record<string, any>[],
  nextCursor: string | null,
  currentModel: string,
  currentThreshold: number,
  audioTableName: string,
  bucketName: string | undefined,
  ddb: any,
  chartMode: boolean,
) {
  if (audioItems.length === 0) {
    return NextResponse.json({ items: [], currentModel, currentThreshold, nextCursor: null });
  }

  // 3. 現在のモデルの RESULT レコードを一括取得 (BatchGetItem は最大100件なので分割)
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
    const BATCH_SIZE = 100;
    for (let i = 0; i < resultKeys.length; i += BATCH_SIZE) {
      const batch = resultKeys.slice(i, i + BATCH_SIZE);
      const batchRes = await ddb.send(new BatchGetItemCommand({
        RequestItems: {
          [audioTableName]: { Keys: batch },
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
    }
  } catch (e) {
    console.warn("[AUDIO] RESULT batch get failed", e);
  }

  // 4. レスポンス構築
  const defaultBucket = bucketName || "recordings-kawasaki-city";

  let items;
  if (chartMode) {
    // チャートモード: 署名付きURLをスキップし軽量レスポンス
    items = audioItems.map((item) => {
      const ts = item.sk!.S!;
      const result = resultMap[ts];
      return {
        key: item.s3Key?.S ?? "",
        lastModified: new Date(parseInt(ts, 10)).toISOString(),
        reconstructionError: result?.reconstructionError,
        isAnomaly: result?.isAnomaly,
      };
    });
  } else {
    // 通常モード: 署名付きURL付き
    const s3 = getS3Client();
    items = await Promise.all(
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
  }

  return NextResponse.json({ items, currentModel, currentThreshold, nextCursor });
}
