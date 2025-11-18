import { NextResponse } from "next/server"
import { GetItemCommand, PutItemCommand } from "@aws-sdk/client-dynamodb"
import { getDynamoDbClient, getAwsRuntimeConfig } from "@/lib/aws"

export const revalidate = 0

function defaults() {
  return {
    qLow: Number(process.env.THRESH_Q_LOW || 0.35),
    qHigh: Number(process.env.THRESH_Q_HIGH || 0.75),
    minMarginDb: Number(process.env.THRESH_MARGIN_MIN_DB || 3),
    onBiasDb: Number(process.env.THRESH_ON_BIAS_DB || 0.5),
    tolDb: Number(process.env.THRESH_TOL_DB || 0.5),
    N: Number(process.env.THRESH_N || 200),
    maxAgeMs: Number(process.env.THRESH_MAX_AGE_MS || 48 * 60 * 60 * 1000),
  }
}

function deriveEquipFromPrefix(prefix?: string) {
  const parts = (prefix || "").split("/").filter(Boolean)
  return parts.length ? parts[parts.length - 1] : undefined
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const cfg = getAwsRuntimeConfig()
  const ddb = getDynamoDbClient()

  let equipmentId = searchParams.get("equipmentId") || deriveEquipFromPrefix(cfg.audioPrefix) || "kawasaki-ras-1"
  const key = { pk: { S: "CONFIG" }, sk: { S: `EQUIP#${equipmentId}` } }
  const res = await ddb.send(new GetItemCommand({ TableName: cfg.audioTableName, Key: key }))
  const d = defaults()
  const item = res.Item
  if (item) {
    const num = (n?: { N?: string }) => (n?.N ? Number(n.N) : undefined)
    const merged = {
      qLow: num(item.qLow) ?? d.qLow,
      qHigh: num(item.qHigh) ?? d.qHigh,
      minMarginDb: num(item.minMarginDb) ?? d.minMarginDb,
      onBiasDb: num(item.onBiasDb) ?? d.onBiasDb,
      tolDb: num(item.tolDb) ?? d.tolDb,
      N: num(item.N) ?? d.N,
      maxAgeMs: num(item.maxAgeMs) ?? d.maxAgeMs,
      manualOnDb: num(item.manualOnDb),
      equipmentId,
      updatedAt: item.updatedAt?.S,
    }
    return NextResponse.json(merged)
  }
  return NextResponse.json({ ...d, equipmentId })
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}))
  const cfg = getAwsRuntimeConfig()
  const ddb = getDynamoDbClient()
  const d = defaults()

  const equipmentId = (payload.equipmentId as string) || deriveEquipFromPrefix(cfg.audioPrefix) || "kawasaki-ras-1"
  const toNum = (v: any, fallback: number) => (typeof v === "number" && isFinite(v) ? v : fallback)

  const qLow = toNum(payload.qLow, d.qLow)
  const qHigh = toNum(payload.qHigh, d.qHigh)
  const minMarginDb = toNum(payload.minMarginDb, d.minMarginDb)
  const onBiasDb = toNum(payload.onBiasDb, d.onBiasDb)
  const tolDb = toNum(payload.tolDb, d.tolDb)
  const N = toNum(payload.N, d.N)
  const maxAgeMs = toNum(payload.maxAgeMs, d.maxAgeMs)
  const manualOnDb = typeof payload.manualOnDb === "number" && isFinite(payload.manualOnDb)
    ? Number(payload.manualOnDb)
    : (typeof payload.volumeDb === "number" && isFinite(payload.volumeDb) ? Number(payload.volumeDb) : undefined)

  const now = new Date().toISOString()
  await ddb.send(new PutItemCommand({
    TableName: cfg.audioTableName,
    Item: {
      pk: { S: "CONFIG" },
      sk: { S: `EQUIP#${equipmentId}` },
      qLow: { N: String(qLow) },
      qHigh: { N: String(qHigh) },
      minMarginDb: { N: String(minMarginDb) },
      onBiasDb: { N: String(onBiasDb) },
      tolDb: { N: String(tolDb) },
      N: { N: String(N) },
      maxAgeMs: { N: String(maxAgeMs) },
      ...(typeof manualOnDb === "number" ? { manualOnDb: { N: String(manualOnDb) } } : {}),
      updatedAt: { S: now },
    }
  }))
  return NextResponse.json({ ok: true, equipmentId, updatedAt: now, qLow, qHigh, minMarginDb, onBiasDb, tolDb, N, maxAgeMs, manualOnDb })
}


