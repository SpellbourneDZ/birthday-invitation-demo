import { NextRequest, NextResponse } from "next/server.js";
import { ADMIN_COOKIE, sameOrigin } from "../../../../lib/admin-auth.ts";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return new Response("Forbidden", { status: 403 });
  const response = NextResponse.redirect(new URL("/admin", request.headers.get("origin")!), 303);
  response.cookies.delete(ADMIN_COOKIE);
  return response;
}
