import { NextResponse } from "next/server";
import { getS3Client, getAwsRuntimeConfig } from "@/lib/aws";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";

export const revalidate = 0;

/** GET: S3 models/ プレフィックス配下の .tflite モデル一覧を返す */
export async function GET() {
  try {
    const { bucketName } = getAwsRuntimeConfig();
    if (!bucketName) {
      return NextResponse.json({ error: "S3_BUCKET_NAME is not set" }, { status: 500 });
    }

    const s3 = getS3Client();
    const res = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: "models/",
      })
    );

    const models = (res.Contents ?? [])
      .filter((obj) => obj.Key?.endsWith(".tflite"))
      .map((obj) => ({
        key: obj.Key!,
        size: obj.Size,
        lastModified: obj.LastModified?.toISOString(),
      }))
      .sort((a, b) => (b.lastModified ?? "").localeCompare(a.lastModified ?? ""));

    return NextResponse.json({ models });
  } catch (err: any) {
    console.error("GET /api/inference/models failed", err);
    return NextResponse.json({ error: err?.message ?? "unknown" }, { status: 500 });
  }
}
