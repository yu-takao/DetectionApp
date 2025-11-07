import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";

const region = process.env.AWS_REGION;
const tableName = process.env.AUDIO_TABLE_NAME;

const ddb = new DynamoDBClient({ region });

export const handler = async (event) => {
  const records = event?.Records ?? [];
  for (const r of records) {
    if (!r?.s3?.object?.key) continue;
    const bucket = r.s3.bucket.name;
    const key = decodeURIComponent(r.s3.object.key.replace(/\+/g, " "));
    const eventTime = r.eventTime ? new Date(r.eventTime).toISOString() : new Date().toISOString();
    const ulid = Math.random().toString(36).slice(2);
    const size = typeof r.s3.object.size === "number" ? r.s3.object.size : 0;

    const item = {
      pk: { S: "AUDIO" },
      sk: { S: `${eventTime}#${ulid}` },
      bucket: { S: bucket },
      key: { S: key },
      size: { N: String(size) },
      contentType: { S: r.s3.object.contentType ?? "audio/wav" },
      lastModified: { S: eventTime },
    };

    await ddb.send(new PutItemCommand({ TableName: tableName, Item: item }));
  }
  return { ok: true, count: records.length };
};

