import { NextRequest } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { fromIni } from "@aws-sdk/credential-providers";

type PresignResponse = {
  url: string;
  key: string;
  method: "PUT";
  headers: Record<string, string>;
  expiresSec: number;
};

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "ap-northeast-1";
const AUDIO_BUCKET = process.env.AUDIO_BUCKET || ""; // 必須（Amplify 環境変数で設定）
const DEFAULT_EXPIRES_SEC = Number(process.env.AUDIO_PRESIGN_EXPIRES_SEC || "300");

const inRuntime = !!process.env.AWS_EXECUTION_ENV;
const useIniProfile = !inRuntime && !!process.env.AWS_PROFILE;

let s3Client = new S3Client({
  region: REGION,
  ...(useIniProfile ? { credentials: fromIni({ profile: process.env.AWS_PROFILE || "trust-kawasaki-city-prod" }) } : {}),
});

function buildKey(params: { thing: string; ext: string }): string {
  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const HH = String(now.getUTCHours()).padStart(2, "0");
  const epochMs = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `audio/manual/${params.thing}/${yyyy}/${mm}/${dd}/${HH}/${epochMs}_${rand}.${params.ext}`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const thing = searchParams.get("thing") || "kawasaki-1";
  const ext = (searchParams.get("ext") || "webm").toLowerCase();
  const contentType =
    ext === "wav" ? "audio/wav" : ext === "mp3" ? "audio/mpeg" : ext === "ogg" ? "audio/ogg" : "audio/webm";
  const expiresSec = Math.min(Math.max(Number(searchParams.get("expires") || DEFAULT_EXPIRES_SEC), 60), 3600);

  if (!AUDIO_BUCKET) {
    return new Response(JSON.stringify({ error: "AUDIO_BUCKET is not configured" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    const key = buildKey({ thing, ext });
    const cmd = new PutObjectCommand({ Bucket: AUDIO_BUCKET, Key: key, ContentType: contentType });
    const url = await getSignedUrl(s3Client, cmd, { expiresIn: expiresSec });
    const payload: PresignResponse = {
      url,
      key,
      method: "PUT",
      headers: { "Content-Type": contentType },
      expiresSec,
    };
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    });
  } catch (err) {
    // ExpiredToken 対応のワンショット再試行
    const msg = String((err as any)?.name || (err as any)?.__type || err || "");
    if (msg.includes("ExpiredToken")) {
      try {
        if (inRuntime) {
          try {
            delete (process.env as any).AWS_ACCESS_KEY_ID;
            delete (process.env as any).AWS_SECRET_ACCESS_KEY;
            delete (process.env as any).AWS_SESSION_TOKEN;
          } catch {}
        }
        const fresh = new S3Client({ region: REGION });
        const key = buildKey({ thing, ext });
        const cmd = new PutObjectCommand({ Bucket: AUDIO_BUCKET, Key: key, ContentType: contentType });
        const url = await getSignedUrl(fresh, cmd, { expiresIn: expiresSec });
        s3Client = fresh;
        const payload: PresignResponse = {
          url,
          key,
          method: "PUT",
          headers: { "Content-Type": contentType },
          expiresSec,
        };
        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: {
            "content-type": "application/json",
            "cache-control": "no-store, no-cache, must-revalidate, max-age=0",
            "x-audio-presign": "s3-retry",
          },
        });
      } catch (e2) {
        // eslint-disable-next-line no-console
        console.error("/api/audio/presign retry failed", e2);
      }
    }
    // eslint-disable-next-line no-console
    console.error("/api/audio/presign error", err);
    return new Response(JSON.stringify({ error: "Failed to create presigned URL" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}


