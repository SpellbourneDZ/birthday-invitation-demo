import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE = "invitation_admin";
const SESSION_AGE = 60 * 60 * 24;
const LOGIN_LIMIT = 10;
let windowStart = 0;
let attempts = 0;

function sessionSecret(): string | null {
  const secret = process.env.ADMIN_SESSION_SECRET;
  const password = process.env.ADMIN_PASSWORD;
  return secret && secret.length >= 32 && password && password.length >= 12 ? `${secret}\0${password}` : null;
}

export function checkPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || !sessionSecret()) return false;
  const actualHash = createHash("sha256").update(input).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(actualHash, expectedHash);
}

export function allowLoginAttempt(now = Date.now()): boolean {
  // shortcut: this global process limit can lock out the owner for one minute and differs across instances; use a trusted client identity with shared storage when available.
  if (now - windowStart >= 60_000) {
    windowStart = now;
    attempts = 0;
  }
  attempts += 1;
  return attempts <= LOGIN_LIMIT;
}

export function createSession(now = Date.now()): string {
  const secret = sessionSecret();
  if (!secret) throw new Error("Admin session is not configured");
  const payload = `v1.${Math.floor(now / 1000) + SESSION_AGE}.${randomBytes(16).toString("base64url")}`;
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function validSession(token: string | undefined, now = Date.now()): boolean {
  const secret = sessionSecret();
  if (!secret || !token || token.length > 256) return false;
  const match = /^(v1\.\d{10}\.[-\w]{22})\.([-\w]{43})$/.exec(token);
  if (!match || Number(match[1].split(".")[1]) <= Math.floor(now / 1000)) return false;
  const expected = createHmac("sha256", secret).update(match[1]).digest();
  const supplied = Buffer.from(match[2], "base64url");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const configured = process.env.ADMIN_ALLOWED_ORIGINS;
  const allowed = configured ? configured.split(",").map(value => value.trim()).filter(Boolean) : process.env.NODE_ENV === "production" ? [] : [new URL(request.url).origin];
  return origin !== null && allowed.includes(origin);
}

export const sessionCookie = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge: SESSION_AGE,
};
