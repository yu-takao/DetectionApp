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
  const tolDb = Number(process.env.THRESH_TOL_DB || 0.5)
  if (isFinite(db)) {
    if (db >= T_on - tolDb) return "on"
    if (db <= T_off + tolDb) return "off"
  }
  return prev
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const cfg = getAwsRuntimeConfig()
  const equipmentIdParam = searchParams.get("equipmentId") || undefined

  const N = Number(process.env.THRESH_N || 200)
  const minSamples = Number(process.env.THRESH_MIN_SAMPLES || 20)
  const maxAgeMs = Number(process.env.THRESH_MAX_AGE_MS || 48 * 60 * 60 * 1000)
  const qLow = Number(process.env.THRESH_Q_LOW || 0.35) // P35
  const qHigh = Number(process.env.THRESH_Q_HIGH || 0.75) // P75
  const minMarginDb = Number(process.env.THRESH_MARGIN_MIN_DB || 3)
  const onBiasDb = Number(process.env.THRESH_ON_BIAS_DB || 0.5) // 稼働側バイアスは控えめ

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
  const deriveEquipFromKey = (k?: string) => {
    if (!k) return undefined
    const parts = k.split("/").filter(Boolean)
    return parts.length >= 2 ? parts[parts.length - 2] : undefined
  }
  const all = (res.Items ?? []).map((it) => {
    const key = it.key?.S as string | undefined
    const equip = (it.equipmentId?.S as string | undefined) || deriveEquipFromKey(key)
    const s = it.lastModified?.S as string | undefined
    const t = s ? Date.parse(s) : NaN
    return {
      dbfs: it.dbfs?.N ? Number(it.dbfs.N) : NaN,
      equipmentId: equip,
      sk: it.sk?.S as string | undefined,
      ts: isNaN(t) ? NaN : t,
    }
  })

  // Decide equipmentId if not provided: choose most frequent in recent items
  let equipmentId = equipmentIdParam
  if (!equipmentId) {
    const counts = new Map<string, number>()
    for (const a of all) {
      if (!a.equipmentId) continue
      counts.set(a.equipmentId, (counts.get(a.equipmentId) || 0) + 1)
    }
    let best: string | undefined
    let bestN = -1
    for (const [k, v] of counts) {
      if (v > bestN) { best = k; bestN = v }
    }
    equipmentId = best
  }
  if (!equipmentId) {
    return NextResponse.json({ error: "equipmentId is required" }, { status: 400 })
  }
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
  const pL = computePercentile(dbs, qLow)
  const pH = computePercentile(dbs, qHigh)
  const gap = pH - pL
  const center = (pL + pH) / 2
  const margin = Math.max(minMarginDb, 0.2 * Math.max(0, gap))
  const T_on = center + margin / 2 + onBiasDb
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
    thresholds: { T_on, T_off, center, margin, pLow: pL, pHigh: pH },
    latest: { dbfs: latest?.dbfs ?? null, at: latest?.sk?.split("#")[0] ?? null },
    running: state,
    confidence,
  })
}


