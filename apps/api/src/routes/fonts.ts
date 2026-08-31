import { Hono } from "hono";
import dinRegular from "../../assets/fonts/D-DIN.woff2";
import dinBold from "../../assets/fonts/D-DIN-Bold.woff2";
import appleTouch from "../../assets/brand/apple-touch-icon.png";
import { FAVICON_SVG } from "../lib/brand";

type AppEnv = { Bindings: Cloudflare.Env };

const FONT: Record<string, ArrayBuffer> = {
  "D-DIN.woff2": dinRegular,
  "D-DIN-Bold.woff2": dinBold,
};

export const fontsApi = new Hono<AppEnv>();

fontsApi.get("/favicon.svg", () => {
  return new Response(FAVICON_SVG, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
});

fontsApi.get("/apple-touch-icon.png", () => {
  return new Response(appleTouch, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
    },
  });
});

fontsApi.get("/fonts/:file", (c) => {
  const file = c.req.param("file");
  const body = FONT[file];
  if (!body) return c.notFound();
  return new Response(body, {
    headers: {
      "Content-Type": "font/woff2",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
});
