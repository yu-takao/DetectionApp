import { NextResponse } from "next/server";
import { dynamoDbClient, s3Client, awsConfig, GetObjectCommand } from "@/lib/aws";
import { QueryCommand } from "@aws-sdk/client-dynamodb";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const revalidate = 0;

export async function GET() {
  try {
    if (!awsConfig.audioTableName) {
      return NextResponse.json({ error: "AUDIO_TABLE_NAME is not set" }, { status: 500 });
    }

    // 最新10件を降順で取得
    const query = new QueryCommand({
      TableName: awsConfig.audioTableName,
      KeyConditionExpression: "pk = :p",
      ExpressionAttributeValues: { ":p": { S: "AUDIO" } },
      ScanIndexForward: false, // 降順
      Limit: 10,
    });
    const res = await dynamoDbClient.send(query);

    const items = await Promise.all(
      (res.Items ?? []).map(async (it) => {
        const bucket = (it.bucket?.S ?? awsConfig.bucketName) as string;
        const key = it.key?.S as string;
        const size = it.size?.N ? Number(it.size.N) : undefined;
        const lastModified = it.lastModified?.S as string | undefined;
        const signed = await getSignedUrl(
          s3Client,
          new GetObjectCommand({ Bucket: bucket, Key: key }),
          { expiresIn: 60 * 5 }
        );
        return { key, url: signed, size, lastModified };
      })
    );

    return NextResponse.json({ items });
  } catch (err: any) {
    // Emit useful diagnostics to logs for production debugging
    // Safe subset only (no secrets)
    // eslint-disable-next-line no-console
    console.error("GET /api/audio/latest failed", {
      message: err?.message,
      name: err?.name,
      stack: err?.stack,
      hasRegion: !!process.env.OTOMONI_REGION || !!process.env.AWS_REGION,
      hasKeyId: !!process.env.OTOMONI_ACCESS_KEY_ID,
      hasSecret: !!process.env.OTOMONI_SECRET_ACCESS_KEY,
      table: awsConfig.audioTableName,
      bucket: awsConfig.bucketName,
    });
    return NextResponse.json({ error: err?.message ?? "unknown" }, { status: 500 });
  }
}

