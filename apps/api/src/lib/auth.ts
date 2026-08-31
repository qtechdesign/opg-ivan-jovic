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
  const expected = c.env.OPERATOR_TOKEN;
  if (!expected) {
    return c.json({ error: "operator_token_not_configured" }, 500);
  }

  const header = c.req.header("Authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) {
    return c.json({ error: "unauthorized", hint: "Bearer OPERATOR_TOKEN" }, 401);
  }

  const ok = await timingSafeEqualString(match[1].trim(), expected);
  if (!ok) {
    return c.json({ error: "unauthorized" }, 401);
  }

  return null;
}
