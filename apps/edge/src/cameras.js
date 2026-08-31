import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLATES_DIR = join(__dirname, "..", "plates");

/** @type {{ id: string, envKey: string, plate: string }[]} */
export const CAMERAS = [
  { id: "cam-yard", envKey: "CAMERA_YARD_RTSP", plate: "cam-yard.jpg" },
  { id: "cam-garden", envKey: "CAMERA_GARDEN_RTSP", plate: "cam-garden.jpg" },
  { id: "cam-hay", envKey: "CAMERA_HAY_RTSP", plate: "cam-hay.jpg" },
];

/**
 * @param {{
 *   dataDir: string,
 *   poljeApi: string,
 *   ingestToken: string,
 *   farmId: string,
 *   go2rtcUrl: string,
 * }} opts
 */
export function createCameraGrabber(opts) {
  const {
    dataDir,
    poljeApi,
    ingestToken,
    farmId,
    go2rtcUrl,
  } = opts;
  const camDir = join(dataDir, "cameras");
  mkdirSync(camDir, { recursive: true });

  let nvrStatus = "unconfigured";

  async function grabOne(cam) {
    const rtsp = process.env[cam.envKey] || "";
    const dest = join(camDir, cam.id, "latest.jpg");
    mkdirSync(dirname(dest), { recursive: true });

    let source = "placeholder";
    let bytes = null;

    if (rtsp) {
      try {
        const url = `${go2rtcUrl.replace(/\/$/, "")}/api/frame.jpeg?src=${encodeURIComponent(cam.id)}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
        if (res.ok) {
          bytes = Buffer.from(await res.arrayBuffer());
          source = "rtsp";
          nvrStatus = "ok";
        } else {
          console.warn("go2rtc frame", cam.id, res.status);
          nvrStatus = "down";
        }
      } catch (err) {
        console.warn("go2rtc fetch failed", cam.id, err.message || err);
        nvrStatus = "down";
      }
    }

    if (!bytes) {
      const plate = join(PLATES_DIR, cam.plate);
      if (existsSync(plate)) {
        copyFileSync(plate, dest);
        bytes = readFileSync(dest);
      } else {
        console.error("missing plate", plate);
        return null;
      }
      source = "placeholder";
      if (!rtsp && nvrStatus === "unconfigured") nvrStatus = "unconfigured";
    } else {
      writeFileSync(dest, bytes);
    }

    return { camera_id: cam.id, source, bytes, path: dest };
  }

  async function upload(snap) {
    if (!ingestToken) return false;
    const form = new FormData();
    form.append(
      "file",
      new Blob([snap.bytes], { type: "image/jpeg" }),
      "latest.jpg"
    );
    form.append("camera_id", snap.camera_id);
    form.append("source", snap.source);
    form.append("farm_slug", farmId);
    try {
      const res = await fetch(`${poljeApi}/v1/ingest/media`, {
        method: "POST",
        headers: { Authorization: `Bearer ${ingestToken}` },
        body: form,
      });
      if (!res.ok) {
        console.error("ingest/media", snap.camera_id, res.status, await res.text());
        return false;
      }
      return true;
    } catch (err) {
      console.error("ingest/media network", err.message || err);
      return false;
    }
  }

  async function ackCommands(cameraId) {
    try {
      const q = new URLSearchParams({
        farm: farmId,
        status: "sent",
        action: "snapshot.take",
        device_id: cameraId,
      });
      const res = await fetch(`${poljeApi}/v1/commands?${q}`, {
        headers: { Authorization: `Bearer ${ingestToken}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      for (const cmd of data.commands || []) {
        await fetch(`${poljeApi}/v1/commands/${cmd.id}`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${ingestToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: "acked" }),
        });
      }
    } catch (err) {
      console.warn("ack commands", err.message || err);
    }
  }

  async function tick() {
    for (const cam of CAMERAS) {
      const snap = await grabOne(cam);
      if (!snap) continue;
      const ok = await upload(snap);
      if (ok) await ackCommands(cam.id);
    }
  }

  async function pollUrgent() {
    if (!ingestToken) return;
    try {
      const q = new URLSearchParams({
        farm: farmId,
        status: "sent",
        action: "snapshot.take",
      });
      const res = await fetch(`${poljeApi}/v1/commands?${q}`, {
        headers: { Authorization: `Bearer ${ingestToken}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const ids = new Set((data.commands || []).map((c) => c.device_id));
      for (const cam of CAMERAS) {
        if (!ids.has(cam.id)) continue;
        const snap = await grabOne(cam);
        if (!snap) continue;
        const ok = await upload(snap);
        if (ok) await ackCommands(cam.id);
      }
    } catch (err) {
      console.warn("urgent snapshot poll", err.message || err);
    }
  }

  return {
    tick,
    pollUrgent,
    getNvrStatus: () => nvrStatus,
  };
}
