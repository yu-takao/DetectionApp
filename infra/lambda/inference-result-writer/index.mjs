/**
 * 推論結果をDynamoDB AudioIndexテーブルに書き込むLambda
 *
 * IoT Ruleから呼び出され、audio/inference/result トピックのメッセージを処理
 */
import { DynamoDBClient, UpdateItemCommand, QueryCommand } from "@aws-sdk/client-dynamodb";

const ddb = new DynamoDBClient({});
const TABLE_NAME = process.env.AUDIO_TABLE_NAME || "AudioIndex";

export const handler = async (event) => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  try {
    const {
      s3_key,
      is_anomaly,
      reconstruction_error,
      threshold,
      inference_time_ms,
      num_samples,
      audio_duration_sec,
      device_serial,
      thing_name,
      timestamp,
    } = event;

    if (!s3_key) {
      console.error("No s3_key in event");
      return { statusCode: 400, body: "Missing s3_key" };
    }

    // AudioIndexテーブルのアイテムを更新
    // pk = "AUDIO", sk = s3_key
    const updateCommand = new UpdateItemCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: { S: "AUDIO" },
        sk: { S: s3_key },
      },
      UpdateExpression: `SET
        isAnomaly = :isAnomaly,
        reconstructionError = :mse,
        inferenceThreshold = :threshold,
        inferenceTimeMs = :inferenceTime,
        inferenceTimestamp = :inferenceTs,
        deviceSerial = :deviceSerial,
        thingName = :thingName`,
      ExpressionAttributeValues: {
        ":isAnomaly": { BOOL: Boolean(is_anomaly) },
        ":mse": { N: String(reconstruction_error ?? 0) },
        ":threshold": { N: String(threshold ?? 5.0) },
        ":inferenceTime": { N: String(inference_time_ms ?? 0) },
        ":inferenceTs": { N: String(Date.now()) },
        ":deviceSerial": { S: device_serial || "unknown" },
        ":thingName": { S: thing_name || "unknown" },
      },
    });

    await ddb.send(updateCommand);

    console.log(`Updated AudioIndex for s3_key: ${s3_key}, isAnomaly: ${is_anomaly}, MSE: ${reconstruction_error}`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Inference result saved",
        s3_key,
        is_anomaly,
        reconstruction_error,
      }),
    };
  } catch (error) {
    console.error("Error processing inference result:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
