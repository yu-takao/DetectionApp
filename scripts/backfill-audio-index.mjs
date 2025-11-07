#!/usr/bin/env node
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { fromNodeProviderChain } from "@aws-sdk/credential-providers";

const region = process.env.AWS_REGION;
if (!region) throw new Error("AWS_REGION is required");

const bucket = process.env.S3_BUCKET_NAME || process.env.BUCKET || process.argv.find(a => a.startsWith("--bucket="))?.split("=")[1];
const prefix = process.env.S3_AUDIO_PREFIX || process.env.PREFIX || process.argv.find(a => a.startsWith("--prefix="))?.split("=")[1] || "";
const tableName = process.env.AUDIO_TABLE_NAME || process.env.TABLE || process.argv.find(a => a.startsWith("--table="))?.split("=")[1] || "AudioIndex";
const keepTop = Number(process.argv.find(a => a.startsWith("--keep="))?.split("=")[1] || 200); // 最新N件だけ保持

if (!bucket) throw new Error("S3_BUCKET_NAME (or --bucket) is required");

const credentials = fromNodeProviderChain();
const s3 = new S3Client({ region, credentials });
const ddb = new DynamoDBClient({ region, credentials });

// 小さな最小ヒープの代わりに配列で十分（N=200程度）
const top = [];

function pushTop(obj) {
  top.push(obj);
  top.sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified));
  if (top.length > keepTop) top.length = keepTop;
}

async function listAll() {
  let token;
  let total = 0;
  do {
    const res = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }));
    const contents = res.Contents || [];
    contents.forEach(o => pushTop(o));
    total += contents.length;
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
    // 進捗ログ（控えめ）
    if (total % 5000 === 0) console.log(`Scanned ${total} objects...`);
  } while (token);
  console.log(`Scanned ${total} objects. Keeping top ${top.length}.`);
}

async function putItems() {
  let written = 0;
  for (const o of top) {
    const iso = new Date(o.LastModified).toISOString();
    const ulid = Math.random().toString(36).slice(2);
    const item = {
      pk: { S: "AUDIO" },
      sk: { S: `${iso}#${ulid}` },
      bucket: { S: bucket },
      key: { S: o.Key },
      size: { N: String(o.Size ?? 0) },
      contentType: { S: "audio/wav" },
      lastModified: { S: iso },
    };
    await ddb.send(new PutItemCommand({ TableName: tableName, Item: item }));
    written++;
  }
  console.log(`Wrote ${written} index items to ${tableName}.`);
}

await listAll();
await putItems();
console.log("Backfill complete.");

