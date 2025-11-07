import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { fromNodeProviderChain } from "@aws-sdk/credential-providers";

const region = process.env.AWS_REGION as string;
if (!region) {
  // Fail fast to make misconfiguration obvious at runtime
  throw new Error("AWS_REGION is not set");
}

export const awsCredentialsProvider = fromNodeProviderChain();

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

