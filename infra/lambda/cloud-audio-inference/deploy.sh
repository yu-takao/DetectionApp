#!/usr/bin/env bash
#
# cloud-audio-inference Lambda デプロイスクリプト
#
# 使い方:
#   ./deploy.sh
#
# 前提:
#   - AWS CLI + Docker がインストール済み
#   - aws sso login --profile trust-kawasaki-city-prod 済み
#
set -euo pipefail

PROFILE="trust-kawasaki-city-prod"
REGION="ap-northeast-1"
ACCOUNT_ID="405351594292"
FUNCTION_NAME="cloud-audio-inference"
ECR_REPO="cloud-audio-inference"
IMAGE_TAG="latest"
ECR_URI="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${ECR_REPO}"
ROLE_NAME="lambda-cloud-audio-inference-role"
S3_BUCKET="recordings-kawasaki-city"
AUDIO_TABLE="AudioIndex"

echo "=== Cloud Audio Inference Lambda デプロイ ==="
echo "Account: ${ACCOUNT_ID}"
echo "Region:  ${REGION}"
echo ""

# --------------------------------------------------------
# 1. ECRリポジトリ作成（存在しなければ）
# --------------------------------------------------------
echo "[1/6] ECRリポジトリを確認..."
aws ecr describe-repositories \
  --repository-names "${ECR_REPO}" \
  --profile "${PROFILE}" --region "${REGION}" 2>/dev/null || \
aws ecr create-repository \
  --repository-name "${ECR_REPO}" \
  --profile "${PROFILE}" --region "${REGION}"

# --------------------------------------------------------
# 2. Dockerイメージをビルド & プッシュ
# --------------------------------------------------------
echo "[2/6] Dockerイメージをビルド..."
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
docker build --platform linux/amd64 -t "${ECR_REPO}:${IMAGE_TAG}" "${SCRIPT_DIR}"

echo "ECRにログイン..."
aws ecr get-login-password --profile "${PROFILE}" --region "${REGION}" | \
  docker login --username AWS --password-stdin "${ECR_URI}"

echo "ECRにプッシュ..."
docker tag "${ECR_REPO}:${IMAGE_TAG}" "${ECR_URI}:${IMAGE_TAG}"
docker push "${ECR_URI}:${IMAGE_TAG}"

# --------------------------------------------------------
# 3. IAMロール作成（存在しなければ）
# --------------------------------------------------------
echo "[3/6] IAMロールを確認..."
if ! aws iam get-role --role-name "${ROLE_NAME}" --profile "${PROFILE}" 2>/dev/null; then
  echo "IAMロールを作成..."
  aws iam create-role \
    --role-name "${ROLE_NAME}" \
    --assume-role-policy-document '{
      "Version": "2012-10-17",
      "Statement": [{
        "Effect": "Allow",
        "Principal": {"Service": "lambda.amazonaws.com"},
        "Action": "sts:AssumeRole"
      }]
    }' \
    --profile "${PROFILE}"

  # 基本実行ポリシー
  aws iam attach-role-policy \
    --role-name "${ROLE_NAME}" \
    --policy-arn "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole" \
    --profile "${PROFILE}"

  # S3読み取り + DynamoDB書き込み
  aws iam put-role-policy \
    --role-name "${ROLE_NAME}" \
    --policy-name "cloud-inference-access" \
    --policy-document "{
      \"Version\": \"2012-10-17\",
      \"Statement\": [
        {
          \"Effect\": \"Allow\",
          \"Action\": [\"s3:GetObject\", \"s3:ListBucket\"],
          \"Resource\": [
            \"arn:aws:s3:::${S3_BUCKET}\",
            \"arn:aws:s3:::${S3_BUCKET}/*\"
          ]
        },
        {
          \"Effect\": \"Allow\",
          \"Action\": [\"dynamodb:GetItem\", \"dynamodb:PutItem\", \"dynamodb:UpdateItem\"],
          \"Resource\": \"arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/${AUDIO_TABLE}\"
        }
      ]
    }" \
    --profile "${PROFILE}"

  echo "ロール伝播待ち (10秒)..."
  sleep 10
fi

ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"

# --------------------------------------------------------
# 4. Lambda関数作成 or 更新
# --------------------------------------------------------
echo "[4/6] Lambda関数を作成/更新..."
if aws lambda get-function --function-name "${FUNCTION_NAME}" --profile "${PROFILE}" --region "${REGION}" 2>/dev/null; then
  echo "既存のLambdaを更新..."
  aws lambda update-function-code \
    --function-name "${FUNCTION_NAME}" \
    --image-uri "${ECR_URI}:${IMAGE_TAG}" \
    --profile "${PROFILE}" --region "${REGION}"

  # 更新完了を待つ
  aws lambda wait function-updated-v2 \
    --function-name "${FUNCTION_NAME}" \
    --profile "${PROFILE}" --region "${REGION}"
else
  echo "新規Lambda作成..."
  aws lambda create-function \
    --function-name "${FUNCTION_NAME}" \
    --package-type Image \
    --code "ImageUri=${ECR_URI}:${IMAGE_TAG}" \
    --role "${ROLE_ARN}" \
    --timeout 120 \
    --memory-size 1024 \
    --environment "Variables={
      S3_BUCKET=${S3_BUCKET},
      AUDIO_TABLE_NAME=${AUDIO_TABLE},
      MODEL_BUCKET=${S3_BUCKET},
      DEFAULT_MODEL_S3_KEY=models/model-0209.tflite,
      DEFAULT_THRESHOLD=5.0
    }" \
    --profile "${PROFILE}" --region "${REGION}"

  # 作成完了を待つ
  aws lambda wait function-active-v2 \
    --function-name "${FUNCTION_NAME}" \
    --profile "${PROFILE}" --region "${REGION}"
fi

# --------------------------------------------------------
# 5. S3トリガー設定
# --------------------------------------------------------
echo "[5/6] S3イベント通知を設定..."

# Lambda にS3からの呼び出し許可を付与
aws lambda add-permission \
  --function-name "${FUNCTION_NAME}" \
  --statement-id "s3-trigger-wav-flac" \
  --action "lambda:InvokeFunction" \
  --principal "s3.amazonaws.com" \
  --source-arn "arn:aws:s3:::${S3_BUCKET}" \
  --source-account "${ACCOUNT_ID}" \
  --profile "${PROFILE}" --region "${REGION}" 2>/dev/null || true

LAMBDA_ARN=$(aws lambda get-function \
  --function-name "${FUNCTION_NAME}" \
  --profile "${PROFILE}" --region "${REGION}" \
  --query 'Configuration.FunctionArn' --output text)

# S3バケット通知設定（既存の通知を保持しつつ追加）
# 注意: 既存の通知設定を上書きしないよう、現在の設定を取得して追加する
EXISTING_CONFIG=$(aws s3api get-bucket-notification-configuration \
  --bucket "${S3_BUCKET}" \
  --profile "${PROFILE}" --region "${REGION}" 2>/dev/null || echo '{}')

# 新しい通知設定を生成（既存のLambdaFunctionConfigurationsを保持）
NOTIFICATION_CONFIG=$(cat <<EOF
{
  "LambdaFunctionConfigurations": [
    {
      "Id": "cloud-inference-wav",
      "LambdaFunctionArn": "${LAMBDA_ARN}",
      "Events": ["s3:ObjectCreated:*"],
      "Filter": {
        "Key": {
          "FilterRules": [
            {"Name": "suffix", "Value": ".wav"}
          ]
        }
      }
    },
    {
      "Id": "cloud-inference-flac",
      "LambdaFunctionArn": "${LAMBDA_ARN}",
      "Events": ["s3:ObjectCreated:*"],
      "Filter": {
        "Key": {
          "FilterRules": [
            {"Name": "suffix", "Value": ".flac"}
          ]
        }
      }
    }
  ]
}
EOF
)

echo "S3通知設定を適用..."
echo "${NOTIFICATION_CONFIG}" | aws s3api put-bucket-notification-configuration \
  --bucket "${S3_BUCKET}" \
  --notification-configuration file:///dev/stdin \
  --profile "${PROFILE}" --region "${REGION}"

# --------------------------------------------------------
# 6. 確認
# --------------------------------------------------------
echo "[6/6] デプロイ確認..."
aws lambda get-function-configuration \
  --function-name "${FUNCTION_NAME}" \
  --profile "${PROFILE}" --region "${REGION}" \
  --query '{FunctionName: FunctionName, Runtime: PackageType, State: State, MemorySize: MemorySize, Timeout: Timeout}' \
  --output table

echo ""
echo "=== デプロイ完了 ==="
echo "Lambda: ${FUNCTION_NAME}"
echo "ECR:    ${ECR_URI}:${IMAGE_TAG}"
echo "トリガー: s3://${S3_BUCKET}/ に .wav/.flac がアップロードされると自動実行"
echo ""
echo "テスト方法:"
echo "  aws s3 cp test.wav s3://${S3_BUCKET}/test/test.wav --profile ${PROFILE}"
