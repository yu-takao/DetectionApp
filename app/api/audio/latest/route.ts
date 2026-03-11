import { NextResponse } from "next/server";
import { getDynamoDbClient, getS3Client, getAwsRuntimeConfig, GetObjectCommand } from "@/lib/aws";
import { QueryCommand } from "@aws-sdk/client-dynamodb";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const revalidate = 0;

export async function GET() {
  try {
    const awsConfig = getAwsRuntimeConfig();
    if (!awsConfig.audioTableName) {
      return NextResponse.json({ error: "AUDIO_TABLE_NAME is not set" }, { status: 500 });
    }

    console.log("[AUDIO_DIAG] config", {
      table: awsConfig.audioTableName,
      bucket: awsConfig.bucketName,
      prefix: awsConfig.audioPrefix,
    });

    const ddb = getDynamoDbClient();
    const s3 = getS3Client();

    // 最新10件を降順で取得
    const query = new QueryCommand({
      TableName: awsConfig.audioTableName,
      KeyConditionExpression: "pk = :p",
      ExpressionAttributeValues: { ":p": { S: "AUDIO" } },
      ScanIndexForward: false,
      Limit: 10,
    });

    const res = await ddb.send(query);
    console.log("[AUDIO_DIAG] ddb.query.ok", { count: (res.Items ?? []).length });

    const items = await Promise.all(
      (res.Items ?? [])
        .filter((it) => it.key?.S || it.sk?.S)
        .map(async (it) => {
          const bucket = (it.bucket?.S ?? awsConfig.bucketName) as string;
          const key = (it.key?.S || it.sk?.S) as string;

          // keyが空の場合やCONFIGはスキップ
          if (!key || key.startsWith("CONFIG") || !key.includes("/")) {
            return null;
          }

          const size = it.size?.N ? Number(it.size.N) : undefined;

          // lastModified を取得、なければファイル名のタイムスタンプから計算
          let lastModified = it.lastModified?.S as string | undefined;
          if (!lastModified) {
            const match = key.match(/rec-(\d+)\./);
            if (match) {
              const ts = parseInt(match[1], 10);
              if (!isNaN(ts)) {
                lastModified = new Date(ts).toISOString();
              }
            }
          }

          // 推論結果を取得
          const isAnomaly = it.isAnomaly?.BOOL;
          const reconstructionError = it.reconstructionError?.N ? Number(it.reconstructionError.N) : undefined;
          const inferenceThreshold = it.inferenceThreshold?.N ? Number(it.inferenceThreshold.N) : undefined;
          const inferenceTimestamp = it.inferenceTimestamp?.N ? Number(it.inferenceTimestamp.N) : undefined;

          // 署名付きURL生成
          const signed = await getSignedUrl(
            s3,
            new GetObjectCommand({ Bucket: bucket, Key: key }),
            { expiresIn: 60 * 5 }
          );

          return {
            key,
            url: signed,
            size,
            lastModified,
            // 推論結果
            isAnomaly,
            reconstructionError,
            inferenceThreshold,
            inferenceTimestamp,
          };
        })
    );

    // nullを除外
    const filteredItems = items.filter((it): it is NonNullable<typeof it> => it !== null);
    console.log("[AUDIO_DIAG] sign.ok", { count: filteredItems.length });

    return NextResponse.json({ items: filteredItems });
  } catch (err: any) {
    const cfg = getAwsRuntimeConfig();
    console.error("GET /api/audio/latest failed", {
      message: err?.message,
      name: err?.name,
      stack: err?.stack,
      table: cfg.audioTableName,
      bucket: cfg.bucketName,
    });
    return NextResponse.json({ error: err?.message ?? "unknown" }, { status: 500 });
  }
}
