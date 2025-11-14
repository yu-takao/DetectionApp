import { NextResponse } from "next/server"
import { QueryCommand } from "@aws-sdk/client-dynamodb"
import { getDynamoDbClient, getAwsRuntimeConfig } from "@/lib/aws"

export const revalidate = 0

function computePercentile(sorted: number[], p: number) {
  if (sorted.length === 0) return NaN
  const idx = Math.round((sorted.length - 1) * p)
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))]
}

function classify(db: number, T_on: number, T_off: number, prev: "on" | "off") {
  if (isFinite(db)) {
    if (db > T_on) return "on"
    if (db < T_off) return "off"
  }
  return prev
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const cfg = getAwsRuntimeConfig()
  const equipmentIdParam = searchParams.get("equipmentId") || undefined
  const defaultEquip = (() => {
    const p = cfg.audioPrefix || ""
    const parts = p.split("/").filter(Boolean)
    return parts.length ? parts[parts.length - 1] : undefined
  })()
  const equipmentId = equipmentIdParam || defaultEquip
  if (!equipmentId) {
    return NextResponse.json({ error: "equipmentId is required" }, { status: 400 })
  }

  const N = Number(process.env.THRESH_N || 200)
  const minSamples = Number(process.env.THRESH_MIN_SAMPLES || 30)
  const maxAgeMs = Number(process.env.THRESH_MAX_AGE_MS || 24 * 60 * 60 * 1000)

  // まずは最新から多めに取り、equipmentId でフィルタ
  const ddb = getDynamoDbClient()
  const q = new QueryCommand({
    TableName: cfg.audioTableName,
    KeyConditionExpression: "pk = :p",
    ExpressionAttributeValues: { ":p": { S: "AUDIO" } },
    ScanIndexForward: false,
    Limit: Math.max(N * 3, 300), // 余裕を持って取得（GSIなしのため）
  })
  const res = await ddb.send(q)
  const now = Date.now()
  const all = (res.Items ?? []).map((it) => ({
    dbfs: it.dbfs?.N ? Number(it.dbfs.N) : NaN,
    equipmentId: it.equipmentId?.S as string | undefined,
    sk: it.sk?.S as string | undefined,
    ts: (() => {
      const s = it.lastModified?.S as string | undefined
      const t = s ? Date.parse(s) : NaN
      return isNaN(t) ? NaN : t
    })(),
  }))
  const filtered = all
    .filter((x) => x.equipmentId === equipmentId)
    .filter((x) => isFinite(x.dbfs))
    .filter((x) => isFinite(x.ts) && now - x.ts <= maxAgeMs)
    .slice(0, N)

  if (filtered.length < minSamples) {
    return NextResponse.json({
      equipmentId,
      status: "insufficient_data",
      samples: filtered.length,
    })
  }

  const dbs = [...filtered.map((x) => x.dbfs)].sort((a, b) => a - b)
  const p30 = computePercentile(dbs, 0.3)
  const p70 = computePercentile(dbs, 0.7)
  const gap = p70 - p30
  const center = (p30 + p70) / 2
  const margin = Math.max(2, 0.2 * Math.max(0, gap))
  const T_on = center + margin / 2
  const T_off = center - margin / 2

  // 最新サンプルでの状態（簡易、ヒステリシスは prev=直近推定で代用）
  const latest = filtered[0] // 降順のはず
  const prevState: "on" | "off" = latest && latest.dbfs > center ? "on" : "off"
  const state = latest ? classify(latest.dbfs, T_on, T_off, prevState) : "off"

  // 簡易 confidence: 境界からの距離 / margin
  const distance = Math.abs((latest?.dbfs ?? center) - center)
  const confidence = Math.max(0, Math.min(1, distance / (margin || 1)))

  return NextResponse.json({
    equipmentId,
    samples: filtered.length,
    thresholds: { T_on, T_off, center, margin, p30, p70 },
    latest: { dbfs: latest?.dbfs ?? null, at: latest?.sk?.split("#")[0] ?? null },
    running: state,
    confidence,
  })
}


