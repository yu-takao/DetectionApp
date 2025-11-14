import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { fromNodeProviderChain } from "@aws-sdk/credential-providers";

// Allow non-reserved env names on hosting platforms (e.g., Amplify Hosting)
// Prefer OTOMONI_* if provided; otherwise fall back to standard AWS_* for local dev.
const region =
  (process.env.OTOMONI_REGION as string) ||
  (process.env.AWS_REGION as string);

if (!region) {
  // Fail fast to make misconfiguration obvious at runtime
  throw new Error("Region is not set (set OTOMONI_REGION or AWS_REGION)");
}

const otmAccessKeyId = process.env.OTOMONI_ACCESS_KEY_ID;
const otmSecretAccessKey = process.env.OTOMONI_SECRET_ACCESS_KEY;
const otmSessionToken = process.env.OTOMONI_SESSION_TOKEN;
const useStaticCreds = !!(otmAccessKeyId && otmSecretAccessKey);

export const awsCredentialsProvider = useStaticCreds
  ? {
      accessKeyId: otmAccessKeyId as string,
      secretAccessKey: otmSecretAccessKey as string,
      sessionToken: otmSessionToken as string | undefined,
    }
  : fromNodeProviderChain();

export const s3Client = new S3Client({ region, credentials: awsCredentialsProvider });
export const dynamoDbClient = new DynamoDBClient({ region, credentials: awsCredentialsProvider });

export const awsConfig = {
  bucketName: process.env.S3_BUCKET_NAME as string,
  audioTableName: process.env.AUDIO_TABLE_NAME as string,
  audioPrefix: process.env.S3_AUDIO_PREFIX || "",
};

export type SignedAudioItem = {
  key: string;
  url: string;
  size?: number;
  lastModified?: string;
};

export { GetObjectCommand };

