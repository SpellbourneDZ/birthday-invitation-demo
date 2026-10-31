import { NextRequest, NextResponse } from "next/server.js";
import { ADMIN_COOKIE, allowLoginAttempt, checkPassword, createSession, sameOrigin, sessionCookie } from "../../../../lib/admin-auth.ts";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return new Response("Forbidden", { status: 403 });
  if (!allowLoginAttempt()) return new Response("Слишком много попыток. Попробуйте позже.", { status: 429 });
  if (!request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded")) {
    return new Response("Invalid request", { status: 415 });
  }
  const length = Number(request.headers.get("content-length"));
  if (length > 1024) return new Response("Invalid request", { status: 413 });
  const reader = request.body?.getReader();
  if (!reader) return new Response("Invalid request", { status: 400 });
  let body = "";
  let bytes = 0;
  const decoder = new TextDecoder("utf-8", { fatal: true });
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 1024) {
        await reader.cancel();
        return new Response("Invalid request", { status: 413 });
      }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
  } catch {
    return new Response("Invalid request", { status: 400 });
  }
  const password = new URLSearchParams(body).get("password");
  if (!password || !checkPassword(password)) {
    return NextResponse.redirect(new URL("/admin?error=1", request.headers.get("origin")!), 303);
  }
  const response = NextResponse.redirect(new URL("/admin", request.headers.get("origin")!), 303);
  response.cookies.set(ADMIN_COOKIE, createSession(), sessionCookie);
  return response;
}
