import type { Context } from "hono";

type AppEnv = { Bindings: Cloudflare.Env };

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

/** Require Bearer OPERATOR_TOKEN. Returns Response on failure, null on success. */
export async function requireOperator(
  c: Context<AppEnv>
): Promise<Response | null> {
  return requireBearer(c, c.env.OPERATOR_TOKEN, "OPERATOR_TOKEN");
}

/** Require Bearer INGEST_TOKEN for edge → cloud ingest. */
export async function requireIngest(
  c: Context<AppEnv>
): Promise<Response | null> {
  return requireBearer(c, c.env.INGEST_TOKEN, "INGEST_TOKEN");
}

/** Accept either OPERATOR_TOKEN or INGEST_TOKEN (Edge polls commands). */
export async function requireOperatorOrIngest(
  c: Context<AppEnv>
): Promise<Response | null> {
  const header = c.req.header("Authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) {
    return c.json(
      { error: "unauthorized", hint: "Bearer OPERATOR_TOKEN|INGEST_TOKEN" },
      401
    );
  }
  const token = match[1].trim();
  const op = c.env.OPERATOR_TOKEN;
  const ing = c.env.INGEST_TOKEN;
  if (op && (await timingSafeEqualString(token, op))) return null;
  if (ing && (await timingSafeEqualString(token, ing))) return null;
  return c.json({ error: "unauthorized" }, 401);
}

async function requireBearer(
  c: Context<AppEnv>,
  expected: string | undefined,
  name: string
): Promise<Response | null> {
  if (!expected) {
    return c.json({ error: `${name.toLowerCase()}_not_configured` }, 500);
  }

  const header = c.req.header("Authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) {
    return c.json({ error: "unauthorized", hint: `Bearer ${name}` }, 401);
  }

  const ok = await timingSafeEqualString(match[1].trim(), expected);
  if (!ok) {
    return c.json({ error: "unauthorized" }, 401);
  }

  return null;
}
