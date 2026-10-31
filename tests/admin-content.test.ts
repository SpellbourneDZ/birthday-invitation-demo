import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server.js";
import { defaultContent, parseContent } from "../lib/content.ts";
import { createSession, validSession, sameOrigin, ADMIN_COOKIE } from "../lib/admin-auth.ts";
import { decodeImage, publishContent } from "../lib/github-content.ts";
import { GET, POST } from "../app/api/admin/content/route.ts";
import { POST as login } from "../app/api/admin/login/route.ts";
import { POST as logout } from "../app/api/admin/logout/route.ts";

process.env.ADMIN_PASSWORD = "test-admin-password";
process.env.ADMIN_SESSION_SECRET = "test-only-session-secret-of-at-least-32-characters";
process.env.ADMIN_ALLOWED_ORIGINS = "https://demo.example";
process.env.INVITATION_GITHUB_TOKEN = "test-token";
process.env.INVITATION_GITHUB_REPOSITORY = "owner/invitation";
const revision = "a".repeat(40);
const head = "b".repeat(40);

test("content validates URLs, cardinality, ids and raster images", () => {
  assert.deepEqual(parseContent(defaultContent), defaultContent);
  assert.throws(() => parseContent({ ...defaultContent, gifts: [] }));
  assert.throws(() => parseContent({ ...defaultContent, gifts: [defaultContent.gifts[0], defaultContent.gifts[0]] }));
  assert.throws(() => parseContent({ ...defaultContent, event: { ...defaultContent.event, mapUrl: "javascript:alert(1)" } }));
  assert.throws(() => parseContent({ ...defaultContent, gifts: [{ id: "../.env", label: "x", image: "/assets/x.png" }] }));
  assert.throws(() => parseContent({ ...defaultContent, gifts: [{ id: "x", label: "x", image: "https://tracker.example/x.png" }] }));
  assert.throws(() => parseContent({ ...defaultContent, gifts: [{ id: "x", label: "x", image: "/assets/../../secret" }] }));
  assert.throws(() => decodeImage("data:image/png;base64,PHNjcmlwdD4="));
  assert.throws(() => decodeImage("data:image/svg+xml;base64,PHN2Zy8+"));
  assert.equal(decodeImage("data:image/png;base64,iVBORw0KGgo=").path.startsWith("uploads/"), true);
});

test("sessions expire, reject tampering and rotation; origins are explicit", () => {
  const now = Date.now();
  const session = createSession(now);
  assert.equal(validSession(session, now), true);
  assert.equal(validSession(session + "x", now), false);
  assert.equal(validSession(session, now + 86_400_000), false);
  process.env.ADMIN_PASSWORD += "rotated";
  assert.equal(validSession(session, now), false);
  process.env.ADMIN_PASSWORD = "test-admin-password";
  assert.equal(sameOrigin(new Request("https://demo.example", { headers: { Origin: "https://attacker.example" } })), false);
  assert.equal(sameOrigin(new Request("https://demo.example", { headers: { Origin: "https://demo.example" } })), true);
});

test("admin endpoints reject unauthenticated and cross-origin writes before GitHub", async () => {
  assert.equal((await GET(new NextRequest("https://demo.example/api/admin/content"))).status, 401);
  const headers = { cookie: `${ADMIN_COOKIE}=${createSession()}`, Origin: "https://attacker.example", "Content-Type": "application/json" };
  assert.equal((await POST(new NextRequest("https://demo.example/api/admin/content", { method: "POST", headers, body: "{}" }))).status, 403);
  headers.Origin = "https://demo.example";
  assert.equal((await POST(new NextRequest("https://demo.example/api/admin/content", { method: "POST", headers, body: "x".repeat(3_500_001) }))).status, 413);
});

test("login issues a protected session, rejects wrong passwords and logout clears it", async () => {
  const request = (password: string) => new NextRequest("https://demo.example/api/admin/login", { method: "POST", headers: { Origin: "https://demo.example", "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ password }) });
  const wrong = await login(request("incorrect"));
  assert.equal(wrong.status, 303);
  assert.match(wrong.headers.get("location")!, /error=1/);
  assert.equal(wrong.headers.get("set-cookie"), null);
  const response = await login(request("test-admin-password"));
  assert.equal(response.status, 303);
  const cookie = response.headers.get("set-cookie")!;
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=strict/i);
  const token = cookie.split(";")[0].split("=")[1];
  assert.equal(validSession(token), true);
  const out = await logout(new NextRequest("https://demo.example/api/admin/logout", { method: "POST", headers: { Origin: "https://demo.example" } }));
  assert.match(out.headers.get("set-cookie")!, /invitation_admin=;/);
});

test("publish preserves the base tree, commits images with content and refuses stale edits", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; body: Record<string, unknown> | undefined }> = [];
  globalThis.fetch = async (url, options) => {
    const path = String(url);
    const body = options?.body ? JSON.parse(String(options.body)) : undefined;
    calls.push({ url: path, body });
    let result = {};
    if (path.includes("/git/ref/heads/")) result = { object: { sha: head } };
    else if (path.includes("/contents/")) result = { sha: revision, content: Buffer.from(JSON.stringify(defaultContent)).toString("base64") };
    else if (path.endsWith(`/git/commits/${head}`)) result = { tree: { sha: "base-tree" } };
    else result = { sha: "new-sha" };
    return Response.json(result);
  };
  try {
    await assert.rejects(publishContent(defaultContent, "c".repeat(40)), /изменилось/);
    assert.equal(calls.some(call => call.body), false);
    calls.length = 0;
    const draft = structuredClone(defaultContent);
    draft.gifts[0].image = "data:image/png;base64,iVBORw0KGgo=";
    const published = await publishContent(draft, revision);
    assert.match(published.content.gifts[0].image, /^\/uploads\/[a-f0-9]{64}\.png$/);
    assert.equal(calls.find(call => call.url.endsWith("git/trees"))?.body?.base_tree, "base-tree");
    const tree = calls.find(call => call.url.endsWith("git/trees"))?.body?.tree as Array<{ path: string; content?: string }>;
    assert.equal(tree.some(file => file.path.startsWith("public/uploads/")), true);
    assert.equal(tree.some(file => file.path === "content/invitation.json"), true);
    assert.equal(calls.at(-1)?.body?.force, false);
    assert.equal(calls.at(-1)?.url.endsWith("git/refs/heads/main"), true);
    assert.equal(draft.gifts[0].image.startsWith("data:"), true);
  } finally { globalThis.fetch = originalFetch; }
});
