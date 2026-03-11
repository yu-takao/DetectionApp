import { NextResponse } from "next/server";
import { getDynamoDbClient, getAwsRuntimeConfig } from "@/lib/aws";
import { GetItemCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";

export const revalidate = 0;

const CONFIG_PK = "CONFIG";
const CONFIG_SK = "INFERENCE";

/** GET: 現在の推論設定を取得 */
export async function GET() {
  try {
    const { audioTableName } = getAwsRuntimeConfig();
    if (!audioTableName) {
      return NextResponse.json({ error: "AUDIO_TABLE_NAME is not set" }, { status: 500 });
    }

    const ddb = getDynamoDbClient();
    const res = await ddb.send(
      new GetItemCommand({
        TableName: audioTableName,
        Key: { pk: { S: CONFIG_PK }, sk: { S: CONFIG_SK } },
      })
    );

    const item = res.Item;
    const config = {
      modelS3Key: item?.modelS3Key?.S ?? "models/model-0209.tflite",
      anomalyThreshold: item?.anomalyThreshold?.N
        ? Number(item.anomalyThreshold.N)
        : 5.0,
    };

    return NextResponse.json(config);
  } catch (err: any) {
    console.error("GET /api/inference/config failed", err);
    return NextResponse.json({ error: err?.message ?? "unknown" }, { status: 500 });
  }
}

/** POST: 推論設定を更新 */
export async function POST(req: Request) {
  try {
    const { audioTableName } = getAwsRuntimeConfig();
    if (!audioTableName) {
      return NextResponse.json({ error: "AUDIO_TABLE_NAME is not set" }, { status: 500 });
    }

    const body = await req.json();
    const modelS3Key = body.modelS3Key;
    const anomalyThreshold = body.anomalyThreshold;

    if (!modelS3Key || typeof modelS3Key !== "string") {
      return NextResponse.json({ error: "modelS3Key is required" }, { status: 400 });
    }
    if (anomalyThreshold == null || typeof anomalyThreshold !== "number" || anomalyThreshold <= 0) {
      return NextResponse.json({ error: "anomalyThreshold must be a positive number" }, { status: 400 });
    }

    const ddb = getDynamoDbClient();
    await ddb.send(
      new PutItemCommand({
        TableName: audioTableName,
        Item: {
          pk: { S: CONFIG_PK },
          sk: { S: CONFIG_SK },
          modelS3Key: { S: modelS3Key },
          anomalyThreshold: { N: String(anomalyThreshold) },
          updatedAt: { S: new Date().toISOString() },
        },
      })
    );

    return NextResponse.json({ ok: true, modelS3Key, anomalyThreshold });
  } catch (err: any) {
    console.error("POST /api/inference/config failed", err);
    return NextResponse.json({ error: err?.message ?? "unknown" }, { status: 500 });
  }
}
