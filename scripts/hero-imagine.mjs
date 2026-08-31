/**
 * Generate the overview hero still with xAI Grok Imagine, JPEG-compress,
 * upload to R2 (local + remote).
 *
 * Usage: npm run hero:imagine
 * Needs XAI_API_KEY in .dev.vars (never printed).
 * Skip production with: HERO_REMOTE=0 npm run hero:imagine
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SLUG = process.env.FARM_SLUG || "ivan-jovic";
const PROMPT =
  process.env.HERO_PROMPT ||
  "Photoreal cinematic 16:9 landscape, no text, no watermark, no logos, no people, no vehicles, no drones, no readable signs. Croatian family farm at golden hour: a 1923 plaster farmhouse, hayfields, a vegetable garden, dark tilled soil, a shallow rain-fed accumulation pond reflecting the sky, distant orchard, quiet documentary photography, analog film grain, overcast spectral light. Empty yard.";

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
  execFileSync("sips", [
    "-s",
    "format",
    "jpeg",
    "-s",
    "formatOptions",
    "72",
    "-Z",
    "1920",
    srcPath,
    "--out",
    destPath,
  ]);
  return statSync(destPath).size;
}

function putR2(filePath, r2Key, remote) {
  const args = [
    "wrangler",
    "r2",
    "object",
    "put",
    `polje-media/${r2Key}`,
    `--file=${filePath}`,
    "--content-type=image/jpeg",
    remote ? "--remote" : "--local",
  ];
  execFileSync("npx", args, { stdio: "inherit" });
}

async function imagine(key, prompt) {
  const attempts = [
    { resolution: "2k", quality: "high" },
    { resolution: "1k", quality: "low" },
  ];
  let lastErr = "xai_failed";
  for (const extra of attempts) {
    const res = await fetch("https://api.x.ai/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "grok-imagine-image-2.0",
        prompt,
        n: 1,
        aspect_ratio: "16:9",
        response_format: "b64_json",
        ...extra,
      }),
    });
    const json = await res.json();
    if (res.ok && json.data?.[0]?.b64_json) {
      return Buffer.from(json.data[0].b64_json, "base64");
    }
    lastErr = json.error?.message || `xai_http_${res.status}`;
    console.warn("xAI attempt failed:", extra, lastErr);
  }
  throw new Error(lastErr);
}

async function main() {
  const vars = loadDevVars();
  const key = vars.XAI_API_KEY;
  if (!key) {
    console.error("Missing XAI_API_KEY in .dev.vars");
    process.exit(1);
  }

  const dir = mkdtempSync(join(tmpdir(), "polje-hero-"));
  const srcPath = join(dir, "source.bin");
  const jpgPath = join(dir, "still.jpg");

  console.log("Calling xAI grok-imagine-image-2.0 for overview hero…");
  const buf = await imagine(key, PROMPT);
  writeFileSync(srcPath, buf);
  console.log("Source bytes:", buf.length);

  const jpgBytes = compressJpeg(srcPath, jpgPath);
  console.log("Hero JPEG:", jpgBytes);

  const r2Key = `${SLUG}/hero/still.jpg`;
  putR2(jpgPath, r2Key, false);
  console.log("Uploaded local R2", r2Key);

  if (process.env.HERO_REMOTE !== "0") {
    putR2(jpgPath, r2Key, true);
    console.log("Uploaded remote R2", r2Key);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
