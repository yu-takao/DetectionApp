# IoT Rule: RecorderConfigAck → DynamoDB

デバイスが設定適用後に `status/{thingName}/recorder/config` に publish する ACK を
DynamoDB `RecorderConfig` テーブルに書き込む IoT Rule。

## 1. DynamoDB テーブル作成

```bash
AWS_PROFILE=trust-kawasaki-city-prod aws dynamodb create-table \
  --table-name RecorderConfig \
  --attribute-definitions \
    AttributeName=pk,AttributeType=S \
    AttributeName=sk,AttributeType=S \
  --key-schema \
    AttributeName=pk,KeyType=HASH \
    AttributeName=sk,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --region ap-northeast-1
```

## 2. IoT Rule 作成

```bash
AWS_PROFILE=trust-kawasaki-city-prod aws iot create-topic-rule \
  --rule-name RecorderConfigAck \
  --topic-rule-payload '{
    "sql": "SELECT \"RECORDER_CONFIG\" AS pk, thing AS sk, enabled, intervalSec, scheduleStartHour, scheduleEndHour, appliedAt FROM \"status/+/recorder/config\"",
    "actions": [
      {
        "dynamoDBv2": {
          "roleArn": "arn:aws:iam::405351594292:role/IoTRuleDynamoDBRole",
          "putItem": {
            "tableName": "RecorderConfig"
          }
        }
      }
    ],
    "ruleDisabled": false,
    "awsIotSqlVersion": "2016-03-23"
  }' \
  --region ap-northeast-1
```

> **注意**: `roleArn` は既存の IoT Rule 用ロールを使うか、新規作成が必要。
> 必要なポリシー: `dynamodb:PutItem` on `arn:aws:dynamodb:ap-northeast-1:405351594292:table/RecorderConfig`

## 3. IAM ロール (必要に応じて)

既存の `IoTRuleDynamoDBRole` があればそれを使用。無ければ:

```bash
# Trust policy
cat > /tmp/iot-assume.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "iot.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}
EOF

AWS_PROFILE=trust-kawasaki-city-prod aws iam create-role \
  --role-name IoTRuleRecorderConfigRole \
  --assume-role-policy-document file:///tmp/iot-assume.json

AWS_PROFILE=trust-kawasaki-city-prod aws iam put-role-policy \
  --role-name IoTRuleRecorderConfigRole \
  --policy-name DDBPutRecorderConfig \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": "dynamodb:PutItem",
      "Resource": "arn:aws:dynamodb:ap-northeast-1:405351594292:table/RecorderConfig"
    }]
  }'
```

## フロー図

```
[Frontend] --(POST)--> [API /device/record-config] --(MQTT)--> cmd/{thing}/recorder/config
                                                                         |
                                                                    [Device]
                                                                         |
                                                              status/{thing}/recorder/config
                                                                         |
                                                               [IoT Rule: RecorderConfigAck]
                                                                         |
                                                               [DynamoDB: RecorderConfig]
                                                                         |
[Frontend] <--(poll GET)-- [API /device/record-config] <--(GetItem)------+
```
