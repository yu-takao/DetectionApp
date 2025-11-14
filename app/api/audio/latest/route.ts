import { NextResponse } from "next/server";
import { getDynamoDbClient, getS3Client, getAwsRuntimeConfig, GetObjectCommand } from "@/lib/aws";
import { GetItemCommand, QueryCommand } from "@aws-sdk/client-dynamodb";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const revalidate = 0;

function computePercentile(sorted: number[], p: number) {
  if (sorted.length === 0) return NaN;
  const idx = Math.round((sorted.length - 1) * p);
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))];
}

function classify(db: number, T_on: number, T_off: number, prev: "on" | "off"): "on" | "off" {
  const tolDb = Number(process.env.THRESH_TOL_DB || 0.5);
  if (db >= T_on - tolDb) return "on";
  if (db <= T_off + tolDb) return "off";
  return prev;
}

export async function GET() {
  try {
    const awsConfig = getAwsRuntimeConfig();
    if (!awsConfig.audioTableName) {
      return NextResponse.json({ error: "AUDIO_TABLE_NAME is not set" }, { status: 500 });
    }

    // Diagnostics: config snapshot
    // eslint-disable-next-line no-console
    console.log("[AUDIO_DIAG] config", {
      table: awsConfig.audioTableName,
      bucket: awsConfig.bucketName,
      prefix: awsConfig.audioPrefix,
      hasRegion: !!(process.env.OTOMONI_REGION || process.env.AWS_REGION),
      usingOTM: !!(process.env.OTOMONI_ACCESS_KEY_ID && process.env.OTOMONI_SECRET_ACCESS_KEY),
    });

    // 最新10件を降順で取得
    const ddb = getDynamoDbClient();
    const s3 = getS3Client();

    const query = new QueryCommand({
      TableName: awsConfig.audioTableName,
      KeyConditionExpression: "pk = :p",
      ExpressionAttributeValues: { ":p": { S: "AUDIO" } },
      ScanIndexForward: false, // 降順
      Limit: 10,
    });
    let res;
    try {
      res = await ddb.send(query);
      // eslint-disable-next-line no-console
      console.log("[AUDIO_DIAG] ddb.query.ok", { count: (res.Items ?? []).length });
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error("[AUDIO_DIAG] ddb.query.error", { name: e?.name, message: e?.message, stack: e?.stack });
      throw e;
    }

    // 補助: 閾値用の広め取得（最大300件）
    const threshQuery = new QueryCommand({
      TableName: awsConfig.audioTableName,
      KeyConditionExpression: "pk = :p",
      ExpressionAttributeValues: { ":p": { S: "AUDIO" } },
      ScanIndexForward: false,
      Limit: 300,
    });
    const threshRes = await ddb.send(threshQuery);

    // equipmentId 推定（プレフィックス末尾）
    const deriveEquipFromKey = (k?: string) => {
      if (!k) return undefined;
      const parts = k.split("/").filter(Boolean);
      return parts.length >= 2 ? parts[parts.length - 2] : undefined;
    };
    const defaultEquip = (() => {
      const parts = (awsConfig.audioPrefix || "").split("/").filter(Boolean);
      return parts.length ? parts[parts.length - 1] : undefined;
    })();

    const allForThresh = (threshRes.Items ?? []).map((it) => {
      const key = it.key?.S as string | undefined;
      const equip = (it.equipmentId?.S as string | undefined) || deriveEquipFromKey(key);
      const dbfs = it.dbfs?.N ? Number(it.dbfs.N) : NaN;
      const lastModified = it.lastModified?.S as string | undefined;
      const ts = lastModified ? Date.parse(lastModified) : NaN;
      return { dbfs, equipmentId: equip, ts };
    }).filter((x) => isFinite(x.dbfs) && isFinite(x.ts));

    const equipmentId = defaultEquip || allForThresh[0]?.equipmentId;
    const cand = allForThresh.filter((x) => !equipmentId || x.equipmentId === equipmentId).slice(0, 200);
    let thresholds: { T_on: number; T_off: number; center: number; margin: number } | null = null;
    if (cand.length >= 20) {
      // Load overrides if present
      let qLow = Number(process.env.THRESH_Q_LOW || 0.35);
      let qHigh = Number(process.env.THRESH_Q_HIGH || 0.75);
      let minMarginDb = Number(process.env.THRESH_MARGIN_MIN_DB || 3);
      let onBiasDb = Number(process.env.THRESH_ON_BIAS_DB || 0.5);
      if (equipmentId) {
        try {
          const cfgItem = await ddb.send(new GetItemCommand({
            TableName: awsConfig.audioTableName,
            Key: { pk: { S: "CONFIG" }, sk: { S: `EQUIP#${equipmentId}` } }
          }));
          const num = (n?: { N?: string }) => (n?.N ? Number(n.N) : undefined);
          if (cfgItem.Item) {
            qLow = num(cfgItem.Item.qLow) ?? qLow;
            qHigh = num(cfgItem.Item.qHigh) ?? qHigh;
            minMarginDb = num(cfgItem.Item.minMarginDb) ?? minMarginDb;
            onBiasDb = num(cfgItem.Item.onBiasDb) ?? onBiasDb;
          }
        } catch {}
      }
      const dbs = [...cand.map((x) => x.dbfs)].sort((a, b) => a - b);
      const pL = computePercentile(dbs, qLow);
      const pH = computePercentile(dbs, qHigh);
      const gap = pH - pL;
      const center = (pL + pH) / 2;
      const margin = Math.max(minMarginDb, 0.2 * Math.max(0, gap));
      thresholds = { T_on: center + margin / 2 + onBiasDb, T_off: center - margin / 2, center, margin };
    }

    let items;
    try {
      items = await Promise.all(
        (res.Items ?? []).map(async (it) => {
          const bucket = (it.bucket?.S ?? awsConfig.bucketName) as string;
          const key = it.key?.S as string;
          const size = it.size?.N ? Number(it.size.N) : undefined;
          const lastModified = it.lastModified?.S as string | undefined;
          const dbfs = it.dbfs?.N ? Number(it.dbfs.N) : undefined;
          const equipmentId = it.equipmentId?.S as string | undefined;
          const signed = await getSignedUrl(
            s3,
            new GetObjectCommand({ Bucket: bucket, Key: key }),
            { expiresIn: 60 * 5 }
          );
          return { key, url: signed, size, lastModified, dbfs, equipmentId };
        })
      );
      // eslint-disable-next-line no-console
      console.log("[AUDIO_DIAG] sign.ok", { count: items.length });
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error("[AUDIO_DIAG] sign.error", { name: e?.name, message: e?.message, stack: e?.stack });
      throw e;
    }

    // サーバ側ヒステリシスで状態補完（最新→古いの順で来るため、古い順に判定して戻す）
    let states: ("on" | "off")[] = [];
    if (thresholds) {
      const asc = [...items]
        .map((x, i) => ({ ...x, idx: i }))
        .sort((a, b) => {
          const ta = a.lastModified ? Date.parse(a.lastModified) : 0;
          const tb = b.lastModified ? Date.parse(b.lastModified) : 0;
          return ta - tb;
        });
      let prev: "on" | "off" = (asc[0]?.dbfs ?? thresholds.center) > thresholds.center ? "on" : "off";
      for (const a of asc) {
        const db = typeof a.dbfs === "number" ? a.dbfs : thresholds.center;
        prev = classify(db, thresholds.T_on, thresholds.T_off, prev);
        states[a.idx] = prev;
      }
    }

    const out = items.map((it, i) => ({
      ...it,
      state: states[i] ?? undefined,
    }));

    return NextResponse.json({ items: out, thresholds: thresholds ?? undefined });
  } catch (err: any) {
    // Emit useful diagnostics to logs for production debugging
    // Safe subset only (no secrets)
    // eslint-disable-next-line no-console
    console.error("GET /api/audio/latest failed", {
      message: err?.message,
      name: err?.name,
      stack: err?.stack,
      hasRegion: !!process.env.OTOMONI_REGION || !!process.env.AWS_REGION,
      hasKeyId: !!process.env.OTOMONI_ACCESS_KEY_ID,
      hasSecret: !!process.env.OTOMONI_SECRET_ACCESS_KEY,
      table: awsConfig.audioTableName,
      bucket: awsConfig.bucketName,
    });
    return NextResponse.json({ error: err?.message ?? "unknown" }, { status: 500 });
  }
}

