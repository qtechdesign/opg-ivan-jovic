/** Open Graph / WhatsApp share stills via xAI Grok Imagine. */

export const OG_MODEL = "grok-imagine-image-2.0";
export const OG_IMAGE_PATH = "/og.jpg";
/** WhatsApp skips large previews; keep JPEG under this. */
export const OG_WHATSAPP_MAX_BYTES = 200_000;
export const OG_WIDTH = 800;
export const OG_HEIGHT = 800;

export const DEFAULT_OG_PROMPT = `Photoreal cinematic still, 16:9, no text, no watermark, no logos, no people, no vehicles, no readable signs. A 1923 Croatian family farmhouse at late afternoon, hayfields and a vegetable garden, dark soil, leaf-green trees, quiet rural mood, overcast spectral light, documentary photography, analog film grain. Empty yard.`;

export const DEFAULT_HERO_PROMPT = `Photoreal cinematic 16:9 landscape, no text, no watermark, no logos, no people, no vehicles, no drones, no readable signs. Croatian family farm at golden hour: a 1923 plaster farmhouse, hayfields, a vegetable garden, dark tilled soil, a shallow rain-fed accumulation pond reflecting the sky, distant orchard, quiet documentary photography, analog film grain, overcast spectral light. Empty yard.`;

export function heroR2Key(slug: string): string {
  return `${slug}/hero/still.jpg`;
}

export function heroSourceR2Key(slug: string): string {
  return `${slug}/hero/source.bin`;
}

export function ogR2Key(slug: string): string {
  return `${slug}/og/share.jpg`;
}

export function ogSourceR2Key(slug: string): string {
  return `${slug}/og/source.bin`;
}

type ImagineImage = { b64_json?: string; url?: string };

type ImagineResponse = {
  data?: ImagineImage[];
  error?: { message?: string };
};

export async function imagineOgJpeg(opts: {
  apiKey: string;
  prompt: string;
  fetchImpl?: typeof fetch;
}): Promise<{ bytes: Uint8Array; contentType: string }> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const res = await fetchImpl("https://api.x.ai/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OG_MODEL,
      prompt: opts.prompt,
      n: 1,
      aspect_ratio: "16:9",
      resolution: "1k",
      quality: "low",
      response_format: "b64_json",
    }),
  });

  const body = (await res.json()) as ImagineResponse;
  if (!res.ok) {
    throw new Error(body.error?.message || `xai_http_${res.status}`);
  }
  const img = body.data?.[0];
  if (!img) throw new Error("xai_empty_image");

  if (img.b64_json) {
    const raw = Uint8Array.from(Buffer.from(img.b64_json, "base64"));
    return { bytes: raw, contentType: sniffImageType(raw) };
  }

  if (!img.url) throw new Error("xai_missing_url");
  const bin = await fetchImpl(img.url);
  if (!bin.ok) throw new Error(`xai_download_${bin.status}`);
  const buf = new Uint8Array(await bin.arrayBuffer());
  return { bytes: buf, contentType: sniffImageType(buf) };
}

function sniffImageType(bytes: Uint8Array): string {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return "application/octet-stream";
}

export async function putOgImage(
  media: R2Bucket,
  slug: string,
  bytes: Uint8Array,
  contentType: string
): Promise<{ key: string; bytes: number; whatsapp_ok: boolean }> {
  const key = ogR2Key(slug);
  await media.put(key, bytes, {
    httpMetadata: { contentType: contentType || "image/jpeg" },
  });
  return {
    key,
    bytes: bytes.byteLength,
    whatsapp_ok: bytes.byteLength <= OG_WHATSAPP_MAX_BYTES && contentType === "image/jpeg",
  };
}
