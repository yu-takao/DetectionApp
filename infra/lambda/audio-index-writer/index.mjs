import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";

const region = process.env.AWS_REGION;
const tableName = process.env.AUDIO_TABLE_NAME;

const ddb = new DynamoDBClient({ region });

export const handler = async (event) => {
  const records = event?.Records ?? [];
  console.log(`[AudioIndexWriter] Processing ${records.length} records`);
  
  for (const r of records) {
    if (!r?.s3?.object?.key) {
      console.log(`[AudioIndexWriter] Skipping record - no key`);
      continue;
    }
    const bucket = r.s3.bucket.name;
    const key = decodeURIComponent(r.s3.object.key.replace(/\+/g, " "));
    
    // .wav ファイルのみ処理
    if (!key.endsWith('.wav')) {
      console.log(`[AudioIndexWriter] Skipping non-wav file: ${key}`);
      continue;
    }

    // sk にはS3のキーをそのまま使用（降順クエリで最新ファイルが先頭に来る）
    const item = {
      pk: { S: "AUDIO" },
      sk: { S: key },
    };

    console.log(`[AudioIndexWriter] Writing item: pk=AUDIO, sk=${key}`);
    await ddb.send(new PutItemCommand({ TableName: tableName, Item: item }));
  }
  
  console.log(`[AudioIndexWriter] Completed. Processed ${records.length} records`);
  return { ok: true, count: records.length };
};

