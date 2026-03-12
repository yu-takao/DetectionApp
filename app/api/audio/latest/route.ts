import { NextResponse } from "next/server";
import { getDynamoDbClient, getS3Client, getAwsRuntimeConfig, GetObjectCommand } from "@/lib/aws";
import { GetItemCommand, BatchGetItemCommand } from "@aws-sdk/client-dynamodb";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const revalidate = 0;

const CONFIG_TABLE = process.env.RECORDER_CONFIG_TABLE || "RecorderConfig";
const THING = "kawasaki-ras-1";

export async function GET() {
  try {
    const awsConfig = getAwsRuntimeConfig();
    const ddb = getDynamoDbClient();
    const s3 = getS3Client();

    // RecorderConfig からアップロード先を取得
    let audioBucket = awsConfig.bucketName;
    let audioPrefix = awsConfig.audioPrefix;
    try {
      const cfgRes = await ddb.send(new GetItemCommand({
        TableName: CONFIG_TABLE,
        Key: { pk: { S: "RECORDER_CONFIG" }, sk: { S: THING } },
      }));
      if (cfgRes.Item) {
        audioBucket = cfgRes.Item.bucket?.S || audioBucket;
        const pfx = cfgRes.Item.prefix?.S;
        if (pfx != null) audioPrefix = `${pfx.replace(/\/+$/, "")}/${THING}/`;
      }
    } catch (e) {
      console.warn("[AUDIO] RecorderConfig read failed, using env defaults", e);
    }

    console.log("[AUDIO_DIAG] config", { bucket: audioBucket, prefix: audioPrefix });

    // S3 からファイル一覧を全件取得し、キー名降順（=最新順）で10件取得
    let allObjects: { Key?: string; Size?: number; LastModified?: Date }[] = [];
    let continuationToken: string | undefined;
    do {
      const listRes = await s3.send(new ListObjectsV2Command({
        Bucket: audioBucket,
        Prefix: audioPrefix,
        MaxKeys: 1000,
        ContinuationToken: continuationToken,
      }));
      if (listRes.Contents) allObjects.push(...listRes.Contents);
      continuationToken = listRes.IsTruncated ? listRes.NextContinuationToken : undefined;
    } while (continuationToken);

    const objects = allObjects
      .filter((obj) => obj.Key && obj.Key.endsWith(".wav"))
      .sort((a, b) => (b.Key ?? "").localeCompare(a.Key ?? ""))
      .slice(0, 10);

    console.log("[AUDIO_DIAG] s3.list.ok", { total: listRes.Contents?.length ?? 0, wav: objects.length });

    if (objects.length === 0) {
      return NextResponse.json({ items: [] });
    }

    // DDB から推論結果を一括取得
    const ddbInference: Record<string, {
      isAnomaly?: boolean;
      reconstructionError?: number;
      inferenceThreshold?: number;
      inferenceTimestamp?: number;
    }> = {};

    if (awsConfig.audioTableName) {
      try {
        const keys = objects.map((obj) => ({
          pk: { S: "AUDIO" },
          sk: { S: obj.Key! },
        }));

        const batchRes = await ddb.send(new BatchGetItemCommand({
          RequestItems: {
            [awsConfig.audioTableName]: { Keys: keys },
          },
        }));

        for (const item of batchRes.Responses?.[awsConfig.audioTableName] ?? []) {
          const sk = item.sk?.S;
          if (!sk) continue;
          ddbInference[sk] = {
            isAnomaly: item.isAnomaly?.BOOL,
            reconstructionError: item.reconstructionError?.N ? Number(item.reconstructionError.N) : undefined,
            inferenceThreshold: item.inferenceThreshold?.N ? Number(item.inferenceThreshold.N) : undefined,
            inferenceTimestamp: item.inferenceTimestamp?.N ? Number(item.inferenceTimestamp.N) : undefined,
          };
        }
      } catch (e) {
        console.warn("[AUDIO] DDB batch get failed, inference data unavailable", e);
      }
    }

    // 署名付き URL 生成 + 推論結果マージ
    const items = await Promise.all(
      objects.map(async (obj) => {
        const key = obj.Key!;

        // lastModified: ファイル名のタイムスタンプ優先、なければ S3 の LastModified
        let lastModified: string | undefined;
        const match = key.match(/rec-(\d+)\./);
        if (match) {
          const ts = parseInt(match[1], 10);
          if (!isNaN(ts)) lastModified = new Date(ts).toISOString();
        }
        if (!lastModified && obj.LastModified) {
          lastModified = obj.LastModified.toISOString();
        }

        const signed = await getSignedUrl(
          s3,
          new GetObjectCommand({ Bucket: audioBucket, Key: key, ResponseContentType: "audio/wav" }),
          { expiresIn: 60 * 5 }
        );

        const inference = ddbInference[key];

        return {
          key,
          url: signed,
          size: obj.Size,
          lastModified,
          isAnomaly: inference?.isAnomaly,
          reconstructionError: inference?.reconstructionError,
          inferenceThreshold: inference?.inferenceThreshold,
          inferenceTimestamp: inference?.inferenceTimestamp,
        };
      })
    );

    console.log("[AUDIO_DIAG] done", { count: items.length });
    return NextResponse.json({ items });
  } catch (err: any) {
    console.error("GET /api/audio/latest failed", {
      message: err?.message,
      name: err?.name,
      stack: err?.stack,
    });
    return NextResponse.json({ error: err?.message ?? "unknown" }, { status: 500 });
  }
}
