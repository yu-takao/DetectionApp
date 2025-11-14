import { DynamoDBClient, QueryCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb"
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3"
import { fromNodeProviderChain } from "@aws-sdk/credential-providers"

const region = process.env.AWS_REGION || process.env.OTOMONI_REGION || "ap-northeast-1"
const tableName = process.env.AUDIO_TABLE_NAME || process.env.OTOMONI_AUDIO_TABLE_NAME || "AudioIndex"
const maxItems = Number(process.env.BACKFILL_DBFS_LIMIT || 200)
const bucket = process.env.S3_BUCKET_NAME || process.env.OTOMONI_S3_BUCKET_NAME || "recordings-kawasaki-city"

const creds = fromNodeProviderChain()
const ddb = new DynamoDBClient({ region, credentials: creds })
const s3 = new S3Client({ region, credentials: creds })

async function streamToBuffer(stream) {
  return await new Promise((resolve, reject) => {
    const chunks = []
    if (stream.on) {
      stream.on("data", (c) => chunks.push(c))
      stream.on("error", reject)
      stream.on("end", () => resolve(Buffer.concat(chunks)))
    } else if (stream.getReader) {
      ;(async () => {
        try {
          const reader = stream.getReader()
          const acc = []
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            acc.push(Buffer.from(value))
          }
          resolve(Buffer.concat(acc))
        } catch (e) {
          reject(e)
        }
      })()
    } else {
      reject(new Error("Unknown stream type"))
    }
  })
}

function parseWavHeader(buf) {
  if (buf.length < 44) return null
  if (buf.toString("ascii", 0, 4) !== "RIFF") return null
  if (buf.toString("ascii", 8, 12) !== "WAVE") return null
  let offset = 12
  let fmt = null
  let dataOffset = null
  while (offset + 8 <= buf.length) {
    const id = buf.toString("ascii", offset, offset + 4)
    const size = buf.readUInt32LE(offset + 4)
    const chunkStart = offset + 8
    if (id === "fmt ") {
      const audioFormat = buf.readUInt16LE(chunkStart)
      const numChannels = buf.readUInt16LE(chunkStart + 2)
      const sampleRate = buf.readUInt32LE(chunkStart + 4)
      const bitsPerSample = buf.readUInt16LE(chunkStart + 14)
      fmt = { audioFormat, numChannels, sampleRate, bitsPerSample }
    } else if (id === "data") {
      dataOffset = chunkStart
      break
    }
    offset = chunkStart + size
  }
  if (!fmt || dataOffset == null) return null
  return { sampleRate: fmt.sampleRate, channels: fmt.numChannels, bitsPerSample: fmt.bitsPerSample, dataOffset }
}

function computeDbfsFromPcm16(buf, channels) {
  const bytesPerSample = 2
  const frameSize = bytesPerSample * channels
  let sumSq = 0
  let count = 0
  for (let i = 0; i + frameSize <= buf.length; i += frameSize) {
    let acc = 0
    for (let ch = 0; ch < channels; ch++) {
      const s = buf.readInt16LE(i + ch * bytesPerSample)
      acc += s / 32768
    }
    const v = acc / channels
    sumSq += v * v
    count++
  }
  const rms = Math.sqrt(sumSq / Math.max(1, count))
  const dbfs = 20 * Math.log10(Math.max(rms, 1e-9))
  return dbfs
}

async function main() {
  console.log(`Backfilling dbfs for latest ${maxItems} items in ${tableName}, region=${region}`)
  const q = new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: "pk = :p",
    ExpressionAttributeValues: { ":p": { S: "AUDIO" } },
    ScanIndexForward: false,
    Limit: maxItems,
  })
  const res = await ddb.send(q)
  const items = res.Items || []
  console.log(`Fetched ${items.length} items`)
  let updated = 0
  for (const it of items) {
    const key = it.key?.S
    const sk = it.sk?.S
    const bkt = it.bucket?.S || bucket
    if (!key || !sk) continue
    if (it.dbfs?.N) continue // already has dbfs
    try {
      const head = await s3.send(new GetObjectCommand({ Bucket: bkt, Key: key, Range: "bytes=0-65535" }))
      const headBuf = await streamToBuffer(head.Body)
      const wav = parseWavHeader(headBuf)
      if (!wav || wav.bitsPerSample !== 16) {
        console.log(`skip non-16bit or invalid wav: ${key}`)
        continue
      }
      const seconds = 3
      const bytesPerSample = wav.bitsPerSample / 8
      const frameSize = bytesPerSample * wav.channels
      const samplesNeeded = wav.sampleRate * seconds
      const bytesNeeded = samplesNeeded * frameSize
      const start = wav.dataOffset
      const end = start + bytesNeeded - 1
      const obj = await s3.send(new GetObjectCommand({ Bucket: bkt, Key: key, Range: `bytes=${start}-${end}` }))
      const buf = await streamToBuffer(obj.Body)
      const dbfs = computeDbfsFromPcm16(buf, wav.channels)
      await ddb.send(new UpdateItemCommand({
        TableName: tableName,
        Key: { pk: { S: "AUDIO" }, sk: { S: sk } },
        UpdateExpression: "SET dbfs = :d",
        ExpressionAttributeValues: { ":d": { N: String(dbfs) } },
      }))
      updated++
      console.log(`updated dbfs: ${key} -> ${dbfs.toFixed(2)} dBFS`)
    } catch (e) {
      console.log(`failed ${key}: ${e?.message}`)
    }
  }
  console.log(`Done. updated=${updated}`)
}

main().catch((e) => { console.error(e); process.exit(1) })


