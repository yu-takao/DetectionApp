import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

const region = process.env.AWS_REGION;
const tableName = process.env.AUDIO_TABLE_NAME;

const ddb = new DynamoDBClient({ region });
const s3 = new S3Client({ region });

async function streamToBuffer(stream) {
  return await new Promise((resolve, reject) => {
    const chunks = [];
    stream.on?.("data", (c) => chunks.push(c));
    stream.on?.("error", reject);
    stream.on?.("end", () => resolve(Buffer.concat(chunks)));
    // For Node >=18 fetch Body (Web stream)
    if (typeof stream === "object" && typeof stream.getReader === "function") {
      // Web stream
      (async () => {
        try {
          const reader = stream.getReader();
          const acc = [];
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            acc.push(Buffer.from(value));
          }
          resolve(Buffer.concat(acc));
        } catch (e) {
          reject(e);
        }
      })();
    }
  });
}

function parseWavHeader(buf) {
  // Minimal RIFF/WAVE header parse for PCM 16bit
  if (buf.length < 44) return null;
  if (buf.toString("ascii", 0, 4) !== "RIFF") return null;
  if (buf.toString("ascii", 8, 12) !== "WAVE") return null;
  // find "fmt " subchunk
  let offset = 12;
  let fmt = null;
  let dataOffset = null;
  while (offset + 8 <= buf.length) {
    const id = buf.toString("ascii", offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    if (id === "fmt ") {
      const audioFormat = buf.readUInt16LE(chunkStart);
      const numChannels = buf.readUInt16LE(chunkStart + 2);
      const sampleRate = buf.readUInt32LE(chunkStart + 4);
      const bitsPerSample = buf.readUInt16LE(chunkStart + 14);
      fmt = { audioFormat, numChannels, sampleRate, bitsPerSample };
    } else if (id === "data") {
      dataOffset = chunkStart;
      break;
    }
    offset = chunkStart + size;
  }
  if (!fmt || dataOffset == null) return null;
  return {
    sampleRate: fmt.sampleRate,
    channels: fmt.numChannels,
    bitsPerSample: fmt.bitsPerSample,
    dataOffset,
  };
}

function computeDbfsFromPcm16(buf, channels) {
  const bytesPerSample = 2;
  const frameSize = bytesPerSample * channels;
  let sumSq = 0;
  let count = 0;
  for (let i = 0; i + frameSize <= buf.length; i += frameSize) {
    let acc = 0;
    for (let ch = 0; ch < channels; ch++) {
      const s = buf.readInt16LE(i + ch * bytesPerSample);
      acc += s / 32768;
    }
    const v = acc / channels;
    sumSq += v * v;
    count++;
  }
  const rms = Math.sqrt(sumSq / Math.max(1, count));
  const dbfs = 20 * Math.log10(Math.max(rms, 1e-9));
  return { rms, dbfs };
}

function extractEquipmentIdFromKey(key) {
  // e.g., phase1/kawasaki-ras-1/rec-xxx.wav -> 'kawasaki-ras-1'
  const parts = key.split("/");
  if (parts.length >= 2) {
    // last folder name
    const folder = parts[parts.length - 2];
    return folder || null;
  }
  return null;
}

export const handler = async (event) => {
  const records = event?.Records ?? [];
  for (const r of records) {
    if (!r?.s3?.object?.key) continue;
    const bucket = r.s3.bucket.name;
    const key = decodeURIComponent(r.s3.object.key.replace(/\+/g, " "));
    const eventTime = r.eventTime ? new Date(r.eventTime).toISOString() : new Date().toISOString();
    const ulid = Math.random().toString(36).slice(2);
    const size = typeof r.s3.object.size === "number" ? r.s3.object.size : 0;
    const equipmentId = extractEquipmentIdFromKey(key);

    const baseItem = {
      pk: { S: "AUDIO" },
      sk: { S: `${eventTime}#${ulid}` },
      bucket: { S: bucket },
      key: { S: key },
      size: { N: String(size) },
      contentType: { S: r.s3.object.contentType ?? "audio/wav" },
      lastModified: { S: eventTime },
    };

    // Try to compute dbfs from first few seconds
    let dbfs = null;
    try {
      const head = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key, Range: "bytes=0-65535" }));
      const headBuf = await streamToBuffer(head.Body);
      const wav = parseWavHeader(headBuf);
      if (wav && wav.bitsPerSample === 16) {
        const seconds = 3;
        const bytesPerSample = wav.bitsPerSample / 8;
        const frameSize = bytesPerSample * wav.channels;
        const samplesNeeded = wav.sampleRate * seconds;
        const bytesNeeded = samplesNeeded * frameSize;
        const start = wav.dataOffset;
        const end = start + bytesNeeded - 1;
        const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key, Range: `bytes=${start}-${end}` }));
        const buf = await streamToBuffer(obj.Body);
        const { dbfs: d } = computeDbfsFromPcm16(buf, wav.channels);
        dbfs = d;
      }
    } catch (e) {
      // swallow; dbfs stays null
      console.log("dbfs compute failed", { key, message: e?.message });
    }

    const item = { ...baseItem };
    if (dbfs !== null) {
      item.dbfs = { N: String(dbfs) };
    }
    if (equipmentId) {
      item.equipmentId = { S: equipmentId };
    }

    await ddb.send(new PutItemCommand({ TableName: tableName, Item: item }));
  }
  return { ok: true, count: records.length };
};

