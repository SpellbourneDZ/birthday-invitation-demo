import { NextRequest } from "next/server.js";
import { ADMIN_COOKIE, sameOrigin, validSession } from "../../../../lib/admin-auth.ts";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return new Response("Forbidden", { status: 403 });
  const authenticated = validSession(request.cookies.get(ADMIN_COOKIE)?.value);
  return Response.json({ authenticated }, { status: authenticated ? 200 : 401, headers: { "Cache-Control": "private, no-store" } });
}
