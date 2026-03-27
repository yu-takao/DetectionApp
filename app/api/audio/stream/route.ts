import { NextRequest, NextResponse } from "next/server";
import { getS3Client, getAwsRuntimeConfig, GetObjectCommand } from "@/lib/aws";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!key) {
    return NextResponse.json({ error: "key is required" }, { status: 400 });
  }

  const { bucketName } = getAwsRuntimeConfig();
  const bucket = bucketName || "recordings-kawasaki-city";
  const s3 = getS3Client();

  const url = await getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: bucket, Key: key, ResponseContentType: "audio/wav" }),
    { expiresIn: 60 * 5 },
  );

  return NextResponse.redirect(url);
}
