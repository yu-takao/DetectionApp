import { NextRequest, NextResponse } from "next/server";
import { jwtVerify, createRemoteJWKSet } from "jose";

const COOKIE_NAME = "sonic-eye-token";
const POOL_ID = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || "";
const REGION = process.env.NEXT_PUBLIC_COGNITO_REGION || "ap-northeast-1";
const ISSUER = `https://cognito-idp.${REGION}.amazonaws.com/${POOL_ID}`;
const JWKS_URI = `${ISSUER}/.well-known/jwks.json`;

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJwks() {
  if (!jwks) jwks = createRemoteJWKSet(new URL(JWKS_URI));
  return jwks;
}

async function isTokenValid(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, getJwks(), { issuer: ISSUER });
    return true;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Login page and static assets are always accessible
  if (pathname.startsWith("/login") || pathname.startsWith("/_next") || pathname === "/icon.svg" || pathname === "/favicon.ico") {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;

  // API routes: return 401 if no token or invalid
  if (pathname.startsWith("/api/")) {
    if (!token || !(await isTokenValid(token))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Pages: redirect to login if no token or invalid
  if (!token || !(await isTokenValid(token))) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
