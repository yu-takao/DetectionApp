import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { fromNodeProviderChain } from "@aws-sdk/credential-providers";

// Build-safe: do NOT read env or construct clients at module import time.
function getRegion(): string {
  const r = (process.env.OTOMONI_REGION as string) || (process.env.AWS_REGION as string);
  if (!r) {
    throw new Error("Region is not set (set OTOMONI_REGION or AWS_REGION)");
  }
  return r;
}

function getCredentials() {
  const id = process.env.OTOMONI_ACCESS_KEY_ID;
  const secret = process.env.OTOMONI_SECRET_ACCESS_KEY;
  const token = process.env.OTOMONI_SESSION_TOKEN;
  return id && secret ? { accessKeyId: id as string, secretAccessKey: secret as string, sessionToken: token as string | undefined } : fromNodeProviderChain();
}

export function getS3Client() {
  return new S3Client({ region: getRegion(), credentials: getCredentials() });
}

export function getDynamoDbClient() {
  return new DynamoDBClient({ region: getRegion(), credentials: getCredentials() });
}

// Read runtime config from environment at call time to avoid build-time freezing.
export function getAwsRuntimeConfig() {
  const bucketName =
    (process.env.S3_BUCKET_NAME as string) ||
    (process.env.OTOMONI_S3_BUCKET_NAME as string) ||
    (process.env.NODE_ENV === "production" ? "recordings-kawasaki-city" : undefined as unknown as string);
  const audioTableName =
    (process.env.AUDIO_TABLE_NAME as string) ||
    (process.env.OTOMONI_AUDIO_TABLE_NAME as string) ||
    (process.env.NODE_ENV === "production" ? "AudioIndex" : undefined as unknown as string);
  const audioPrefix =
    process.env.S3_AUDIO_PREFIX ||
    process.env.OTOMONI_S3_AUDIO_PREFIX ||
    (process.env.NODE_ENV === "production" ? "phase1/kawasaki-ras-1/" : "");
  return { bucketName, audioTableName, audioPrefix };
}

export type SignedAudioItem = {
  key: string;
  url: string;
  size?: number;
  lastModified?: string;
};

export { GetObjectCommand };

