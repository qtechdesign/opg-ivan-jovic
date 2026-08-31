import type { Context } from "hono";

type AppEnv = { Bindings: Cloudflare.Env };

export const OPERATOR_COOKIE = "polje_op";
const SESSION_TTL_SEC = 30 * 24 * 60 * 60;

export async function timingSafeEqualString(
  a: string,
  b: string
): Promise<boolean> {
  const enc = new TextEncoder();
  const aa = enc.encode(a);
  const bb = enc.encode(b);
  if (aa.byteLength !== bb.byteLength) {
    return false;
  }
  let out = 0;
  for (let i = 0; i < aa.byteLength; i++) {
    out |= aa[i]! ^ bb[i]!;
  }
  return out === 0;
}

function parseCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    if (k === name) return part.slice(idx + 1).trim();
  }
  return null;
}

async function hmacHex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data)
  );
  return [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function mintOperatorCookieValue(secret: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SEC;
  const payload = `v1.${exp}`;
  const mac = await hmacHex(secret, payload);
  return `${payload}.${mac}`;
}

export async function operatorCookieValid(
  secret: string,
  cookieHeader: string | undefined
): Promise<boolean> {
  const raw = parseCookie(cookieHeader, OPERATOR_COOKIE);
  if (!raw) return false;
  const parts = raw.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return false;
  const exp = Number(parts[1]);
  if (!Number.isFinite(exp) || exp < Date.now() / 1000) return false;
  const payload = `v1.${parts[1]}`;
  const mac = await hmacHex(secret, payload);
  return timingSafeEqualString(mac, parts[2]);
}

export function setOperatorCookieHeader(
  value: string,
  secure: boolean,
  maxAge = SESSION_TTL_SEC
): string {
  const parts = [
    `${OPERATOR_COOKIE}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearOperatorCookieHeader(secure: boolean): string {
  const parts = [
    `${OPERATOR_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function requestIsHttps(c: Context<AppEnv>): boolean {
  const url = new URL(c.req.url);
  if (url.protocol === "https:") return true;
  return c.req.header("x-forwarded-proto") === "https";
}

async function bearerMatches(
  header: string | undefined,
  expected: string | undefined
): Promise<boolean> {
  if (!expected) return false;
  const match = /^Bearer\s+(.+)$/i.exec(header ?? "");
  if (!match) return false;
  return timingSafeEqualString(match[1].trim(), expected);
}

export async function isOperator(c: Context<AppEnv>): Promise<boolean> {
  const op = c.env.OPERATOR_TOKEN;
  if (!op) return false;
  if (await bearerMatches(c.req.header("Authorization"), op)) return true;
  return operatorCookieValid(op, c.req.header("Cookie"));
}

/** Safe in-app path for login ?next= (no open redirects). */
export function safeNextPath(raw: string | undefined | null): string {
  const next = (raw || "").trim();
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("://")) {
    return "/land";
  }
  return next;
}

export async function requireOperatorHtml(
  c: Context<AppEnv>
): Promise<Response | null> {
  if (await isOperator(c)) return null;
  const url = new URL(c.req.url);
  const next = encodeURIComponent(`${url.pathname}${url.search}`);
  return c.redirect(`/login?next=${next}`, 302);
}

export async function loginCredentialsOk(
  c: Context<AppEnv>,
  email: string,
  password: string
): Promise<boolean> {
  const wantEmail = (c.env.OPERATOR_EMAIL || "").trim().toLowerCase();
  const gotEmail = email.trim().toLowerCase();
  if (!wantEmail || gotEmail !== wantEmail) return false;
  const wantPass = c.env.OPERATOR_PASSWORD || c.env.OPERATOR_TOKEN;
  if (!wantPass) return false;
  return timingSafeEqualString(password, wantPass);
}

export async function requireOperator(
  c: Context<AppEnv>
): Promise<Response | null> {
  if (!c.env.OPERATOR_TOKEN) {
    return c.json({ error: "operator_token_not_configured" }, 500);
  }
  if (await isOperator(c)) return null;
  return c.json({ error: "unauthorized" }, 401);
}

export async function requireIngest(
  c: Context<AppEnv>
): Promise<Response | null> {
  const expected = c.env.INGEST_TOKEN;
  if (!expected) {
    return c.json({ error: "ingest_token_not_configured" }, 500);
  }
  const ok = await bearerMatches(c.req.header("Authorization"), expected);
  if (!ok) {
    return c.json({ error: "unauthorized", hint: "Bearer INGEST_TOKEN" }, 401);
  }
  return null;
}

export async function requireOperatorOrIngest(
  c: Context<AppEnv>
): Promise<Response | null> {
  if (await isOperator(c)) return null;
  const ing = c.env.INGEST_TOKEN;
  if (ing && (await bearerMatches(c.req.header("Authorization"), ing))) {
    return null;
  }
  return c.json({ error: "unauthorized" }, 401);
}
