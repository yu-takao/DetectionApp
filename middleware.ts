import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Login page and static assets are always accessible
  if (pathname.startsWith("/login") || pathname.startsWith("/_next") || pathname === "/icon.svg" || pathname === "/favicon.ico") {
    return NextResponse.next();
  }

  const token = req.cookies.get("auth-token")?.value;

  // API routes: return 401 if no token
  if (pathname.startsWith("/api/")) {
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Pages: redirect to login if no token
  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
