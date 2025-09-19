## Amplify/Next.js 実行ロールの恒久設定手順

このプロジェクトの `app/api/heartbeat/route.ts` は AWS SDK v3 を用いて DynamoDB を読み取ります。Amplify の実行環境では、固定のアクセスキーを環境変数で渡さず、実行ロールの一時クレデンシャルを使う構成にします。

### 1. Amplify 環境から固定クレデンシャルを撤去

- 削除対象（存在する場合）：
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
  - `AWS_SESSION_TOKEN`
- 任意に残す：
  - `AWS_REGION`（既定は `ap-northeast-1`）
  - `HEARTBEAT_TABLE`（既定は `device_status`）
  - `HEARTBEAT_ACTIVE_THRESHOLD_SEC`（既定は `90`）
  - `HEARTBEAT_FALLBACK_CACHE_TTL_MS`（既定は `120000`）

### 2. 実行ロールに最小権限の付与

`ddb-policy.json` を参考に、Amplify のバックエンド実行ロール（または SSR 実行ロール）へ以下を付与します。

許可アクション：`dynamodb:GetItem`, `dynamodb:Scan`, `dynamodb:DescribeTable`

リソース：`arn:aws:dynamodb:ap-northeast-1:<ACCOUNT_ID>:table/device_status`

### 3. デプロイ（再ビルド）

環境変数の更新・ロール更新後は再デプロイが必要です。

### 4. 動作確認

- ブラウザの Network で `/api/heartbeat` のレスポンスヘッダ `x-heartbeat-source` を確認：
  - `ddb` または `ddb-retry`：DynamoDB から取得成功
  - `fallback-cache`：直近成功値を TTL 内で再利用
  - `fallback-offline` / `fallback-resource-not-found`：DDB 未到達やテーブルなし
- CloudWatch Logs に `ExpiredTokenException` が出ていないことを確認

### 補足

ローカル開発では `AWS_PROFILE` を指定して `~/.aws/credentials` から読み取ります（`fromIni`）。本番（`AWS_EXECUTION_ENV` が存在）では実行ロールに自動で委譲します。

### 5. S3 へのアップロード権限（手動音採取）

Amplify 実行ロールに、音声保存用バケットへの Put を最小権限で付与してください。

例（インラインポリシー）
```
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject"],
      "Resource": "arn:aws:s3:::<AUDIO_BUCKET>/audio/manual/*"
    }
  ]
}
```

環境変数（Amplify）
- `AUDIO_BUCKET`: 音声を保存する S3 バケット名（必須）
- `AUDIO_PRESIGN_EXPIRES_SEC`: 署名URLの有効秒（既定 300）


