import { NextRequest } from "next/server.js";
import { ADMIN_COOKIE, sameOrigin, validSession } from "../../../../lib/admin-auth.ts";
import { PublishError, publishContent, readGithubContent } from "../../../../lib/github-content.ts";

export const runtime = "nodejs";
export const maxDuration = 60;

function failure(error: unknown) {
  return Response.json({ error: error instanceof Error ? error.message : "Не удалось выполнить запрос" }, { status: error instanceof PublishError ? error.status : 400, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: NextRequest) {
  if (!validSession(request.cookies.get(ADMIN_COOKIE)?.value)) return new Response("Unauthorized", { status: 401 });
  try { return Response.json(await readGithubContent(), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return failure(error); }
}

export async function POST(request: NextRequest) {
  if (!validSession(request.cookies.get(ADMIN_COOKIE)?.value)) return new Response("Unauthorized", { status: 401 });
  if (!sameOrigin(request)) return new Response("Forbidden", { status: 403 });
  if (!request.headers.get("content-type")?.startsWith("application/json")) return new Response("Invalid content type", { status: 415 });
  try {
    const reader = request.body?.getReader();
    if (!reader) return new Response("Empty body", { status: 400 });
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 3_500_000) { await reader.cancel(); return new Response("Слишком много изображений. Уменьшите их размер.", { status: 413 }); }
      chunks.push(value);
    }
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (typeof body.revision !== "string" || !/^[a-f0-9]{40}$/.test(body.revision)) return new Response("Invalid revision", { status: 400 });
    return Response.json(await publishContent(body.content, body.revision), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}
