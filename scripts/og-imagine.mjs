/**
 * Generate the WhatsApp/OG share JPEG with xAI Grok Imagine,
 * compress it under 180 KB, upload to R2.
 *
 * Usage: npm run og:imagine
 * Needs XAI_API_KEY in .dev.vars (never printed).
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const MAX_BYTES = 180_000;
const SLUG = process.env.FARM_SLUG || "ivan-jovic";
const PROMPT =
  process.env.OG_PROMPT ||
  "Photoreal cinematic still, 16:9, no text, no watermark, no logos, no people, no vehicles, no readable signs. A 1923 Croatian family farmhouse at late afternoon, hayfields and a vegetable garden, dark soil, leaf-green trees, quiet rural mood, overcast spectral light, documentary photography, analog film grain. Empty yard.";

function loadDevVars() {
  const text = readFileSync(".dev.vars", "utf8");
  const out = {};
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    let v = t.slice(i + 1);
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[t.slice(0, i)] = v;
  }
  return out;
}

function compressJpeg(srcPath, destPath) {
  for (const q of [55, 50, 45, 40, 35, 30]) {
    execFileSync("sips", [
      "-s",
      "format",
      "jpeg",
      "-s",
      "formatOptions",
      String(q),
      "-Z",
      "800",
      srcPath,
      "--out",
      destPath,
    ]);
    const n = statSync(destPath).size;
    if (n <= MAX_BYTES) return n;
  }
  return statSync(destPath).size;
}

async function main() {
  const vars = loadDevVars();
  const key = vars.XAI_API_KEY;
  if (!key) {
    console.error("Missing XAI_API_KEY in .dev.vars");
    process.exit(1);
  }

  const dir = mkdtempSync(join(tmpdir(), "polje-og-"));
  const srcPath = join(dir, "source.bin");
  const jpgPath = join(dir, "share.jpg");

  console.log("Calling xAI grok-imagine-image-2.0 (16:9, 1k, low)…");
  const res = await fetch("https://api.x.ai/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "grok-imagine-image-2.0",
      prompt: PROMPT,
      n: 1,
      aspect_ratio: "16:9",
      resolution: "1k",
      quality: "low",
      response_format: "b64_json",
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    console.error("xAI error", res.status, json.error || json);
    process.exit(1);
  }
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) {
    console.error("xAI returned no image");
    process.exit(1);
  }
  writeFileSync(srcPath, Buffer.from(b64, "base64"));
  const srcBytes = statSync(srcPath).size;
  console.log("Source bytes:", srcBytes);

  const jpgBytes = compressJpeg(srcPath, jpgPath);
  console.log("WhatsApp JPEG:", jpgBytes, jpgBytes <= MAX_BYTES ? "(ok)" : "(still large)");

  const r2Key = `${SLUG}/og/share.jpg`;
  execFileSync(
    "npx",
    [
      "wrangler",
      "r2",
      "object",
      "put",
      `polje-media/${r2Key}`,
      `--file=${jpgPath}`,
      "--content-type=image/jpeg",
      "--remote",
    ],
    { stdio: "inherit" }
  );
  console.log("Uploaded R2", r2Key);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
