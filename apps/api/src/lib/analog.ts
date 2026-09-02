import type { IngestBatch, IngestReading } from "@polje/schema";
import { farmStub, type FarmLiveState } from "../do/farm-runtime";
import { localDateInTz } from "./energy";
import { hourInZone } from "./weather";

/**
 * Public climate analog — Čigoč / Lonjsko polje (Sisak-Moslavina).
 * Nature-park coordinates, not the private plot. Same Pannonian
 * continental climate as the holding (hot summers, frost winters, storks).
 */
export const ANALOG_CLIMATE = {
  name: "Čigoč, Lonjsko polje",
  name_hr: "Čigoč, Lonjsko polje",
  country: "HR",
  lat: 45.41,
  lon: 16.63,
  timezone: "Europe/Zagreb",
  source: "open-meteo",
  note: "Climate analog until sensors are on this land. Not farm GPS.",
} as const;

const ARRAY_KWP = 4;
const PERF_RATIO = 0.78;
const STALE_MS = 15 * 60 * 1000;
const BUCKET_MS = 5 * 60 * 1000;
const FETCH_MS = 4000;

export type AnalogObservation = {
  temp_c: number;
  rh: number;
  precip_mm: number;
  cloud_cover: number;
  weather_code: number;
  wind_ms: number;
  ghi_wm2: number;
  soil_moisture: number;
  is_day: boolean;
  kwh_today: number;
  source: "open-meteo" | "synthetic";
};

type EnvLike = Cloudflare.Env & { ANALOG_LIVE?: string };

export function analogLiveOn(env: Cloudflare.Env): boolean {
  const v = (env as EnvLike).ANALOG_LIVE;
  return v !== "0" && v !== "false";
}

export function analogBatchId(slug: string, at = Date.now()): string {
  return `analog-${slug}-${Math.floor(at / BUCKET_MS)}`;
}

export function isAnalogBatchId(batchId: string | null | undefined): boolean {
  return !!batchId && batchId.startsWith("analog-");
}

export function analogPublicMeta() {
  return {
    demo: true as const,
    climate: {
      place: ANALOG_CLIMATE.name,
      lat: ANALOG_CLIMATE.lat,
      lon: ANALOG_CLIMATE.lon,
      source: ANALOG_CLIMATE.source,
      note: ANALOG_CLIMATE.note,
    },
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function syntheticObservation(at = new Date()): AnalogObservation {
  const hour = hourInZone(ANALOG_CLIMATE.timezone, at);
  const month = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: ANALOG_CLIMATE.timezone,
      month: "numeric",
    }).format(at)
  );
  const is_day = hour >= 6 && hour < 20;
  const seasonal =
    month >= 6 && month <= 8 ? 24 : month >= 9 && month <= 10 ? 18 : month <= 2 ? 2 : 12;
  const diurnal = is_day ? 4 * Math.sin(((hour - 8) / 12) * Math.PI) : -3;
  const temp_c = round1(seasonal + diurnal);
  const ghi_wm2 = is_day
    ? Math.max(0, round1(780 * Math.sin(((hour - 6) / 14) * Math.PI)))
    : 0;
  const hoursOn = clamp(hour - 6, 0, 14);
  const kwh_today = round1(hoursOn * ARRAY_KWP * (ghi_wm2 / 1000) * PERF_RATIO * 0.55);
  return {
    temp_c,
    rh: is_day ? 58 : 82,
    precip_mm: 0,
    cloud_cover: is_day ? 28 : 12,
    weather_code: is_day ? 1 : 0,
    wind_ms: round1(2.4 + (hour % 5) * 0.3),
    ghi_wm2,
    soil_moisture: 0.31,
    is_day,
    kwh_today,
    source: "synthetic",
  };
}

type OpenMeteoJson = {
  current?: {
    temperature_2m?: number;
    relative_humidity_2m?: number;
    precipitation?: number;
    cloud_cover?: number;
    weather_code?: number;
    wind_speed_10m?: number;
    shortwave_radiation?: number;
    is_day?: number;
  };
  hourly?: {
    time?: string[];
    shortwave_radiation?: number[];
    soil_moisture_0_to_7cm?: number[];
  };
};

function kwhFromHourly(
  times: string[] | undefined,
  ghi: number[] | undefined,
  now: Date
): number {
  if (!times?.length || !ghi?.length) return 0;
  const today = localDateInTz(now, ANALOG_CLIMATE.timezone);
  let kwh = 0;
  for (let i = 0; i < times.length; i++) {
    const t = new Date(times[i]!);
    if (Number.isNaN(t.getTime())) continue;
    if (t > now) continue;
    if (localDateInTz(t, ANALOG_CLIMATE.timezone) !== today) continue;
    const rad = ghi[i] ?? 0;
    kwh += ARRAY_KWP * (Math.max(0, rad) / 1000) * PERF_RATIO;
  }
  return round1(kwh);
}

function soilNow(
  times: string[] | undefined,
  soil: number[] | undefined,
  now: Date
): number | null {
  if (!times?.length || !soil?.length) return null;
  let best: number | null = null;
  let bestDt = Infinity;
  for (let i = 0; i < times.length; i++) {
    const t = new Date(times[i]!);
    const dt = Math.abs(t.getTime() - now.getTime());
    const v = soil[i];
    if (typeof v !== "number" || Number.isNaN(t.getTime())) continue;
    if (dt < bestDt) {
      bestDt = dt;
      best = v;
    }
  }
  return best;
}

export async function fetchAnalogObservation(
  at = new Date()
): Promise<AnalogObservation> {
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${ANALOG_CLIMATE.lat}&longitude=${ANALOG_CLIMATE.lon}` +
    "&current=temperature_2m,relative_humidity_2m,precipitation,cloud_cover,weather_code,wind_speed_10m,shortwave_radiation,is_day" +
    "&hourly=shortwave_radiation,soil_moisture_0_to_7cm" +
    "&forecast_days=1&wind_speed_unit=ms&timezone=Europe%2FZagreb";
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return syntheticObservation(at);
    const body = (await res.json()) as OpenMeteoJson;
    const c = body.current;
    if (!c || typeof c.temperature_2m !== "number") return syntheticObservation(at);
    const soil =
      soilNow(body.hourly?.time, body.hourly?.soil_moisture_0_to_7cm, at) ?? 0.3;
    return {
      temp_c: round1(c.temperature_2m),
      rh: round1(c.relative_humidity_2m ?? 65),
      precip_mm: round1(c.precipitation ?? 0),
      cloud_cover: round1(c.cloud_cover ?? 0),
      weather_code: c.weather_code ?? 0,
      wind_ms: round1(c.wind_speed_10m ?? 1.5),
      ghi_wm2: round1(c.shortwave_radiation ?? 0),
      soil_moisture: round2(clamp(soil, 0.05, 0.55)),
      is_day: (c.is_day ?? 1) === 1,
      kwh_today: kwhFromHourly(
        body.hourly?.time,
        body.hourly?.shortwave_radiation,
        at
      ),
      source: "open-meteo",
    };
  } catch {
    return syntheticObservation(at);
  } finally {
    clearTimeout(timer);
  }
}

export function buildAnalogBatch(
  farmSlug: string,
  obs: AnalogObservation,
  at = new Date()
): IngestBatch {
  const ts = at.toISOString();
  const hour = hourInZone(ANALOG_CLIMATE.timezone, at);
  const solar_w = round1(ARRAY_KWP * 1000 * (obs.ghi_wm2 / 1000) * PERF_RATIO);
  const house = round1(clamp(obs.temp_c + (obs.is_day ? 3.2 : 5.4), 10, 28));
  const battery = round1(clamp(76 + 8 * Math.sin((hour / 24) * Math.PI * 2), 58, 94));
  const frost: "idle" | "watch" = obs.temp_c < 2 ? "watch" : "idle";

  const readings: IngestReading[] = [
    { device_id: "temp-yard-1", metric: "temp_c", value: obs.temp_c, ts },
    { device_id: "temp-yard-1", metric: "rh", value: obs.rh, ts },
    { device_id: "temp-yard-1", metric: "weather_code", value: obs.weather_code, ts },
    { device_id: "temp-yard-1", metric: "cloud_cover", value: obs.cloud_cover, ts },
    { device_id: "temp-yard-1", metric: "precip_mm", value: obs.precip_mm, ts },
    { device_id: "fps-sn-1", metric: "temp_c", value: obs.temp_c, ts },
    { device_id: "fps-sn-1", metric: "rh", value: obs.rh, ts },
    { device_id: "fps-sn-1", metric: "wind_ms", value: obs.wind_ms, ts },
    { device_id: "soil-n-1", metric: "moisture", value: obs.soil_moisture, ts },
    { device_id: "temp-house-1", metric: "temp_c", value: house, ts },
    { device_id: "temp-house-1", metric: "rh", value: round1(clamp(obs.rh - 8, 35, 90)), ts },
    { device_id: "inv-1", metric: "w", value: solar_w, ts },
    { device_id: "inv-1", metric: "kwh_today", value: obs.kwh_today, ts },
    { device_id: "ups-1", metric: "battery_pct", value: battery, ts },
    { device_id: "edge-1", metric: "w", value: 18, ts },
    { device_id: "heater-house-1", metric: "w", value: 0, ts },
  ];

  return {
    farm_id: farmSlug,
    batch_id: analogBatchId(farmSlug, at.getTime()),
    sent_at: ts,
    readings,
    health: {
      starlink: "up",
      edge: "ok",
      mqtt: "ok",
      gateway: "ok",
      nvr: "unconfigured",
      frost,
    },
  };
}

function shouldRefreshAnalog(live: FarmLiveState, now = Date.now()): boolean {
  const last = live.last_ingest_at
    ? Date.parse(live.last_ingest_at)
    : NaN;
  const fresh = Number.isFinite(last) && now - last < STALE_MS;
  if (fresh && live.last_batch_id && !isAnalogBatchId(live.last_batch_id)) {
    return false;
  }
  if (fresh && live.last_batch_id === analogBatchId(live.farm_id, now)) {
    return false;
  }
  return true;
}

async function readLive(
  env: Cloudflare.Env,
  slug: string
): Promise<FarmLiveState> {
  const stub = farmStub(env, slug);
  const res = await stub.fetch(
    new Request(`https://do/overview?farm_id=${encodeURIComponent(slug)}`)
  );
  return (await res.json()) as FarmLiveState;
}

export async function maybeIngestAnalog(
  env: Cloudflare.Env,
  slug: string
): Promise<boolean> {
  if (!analogLiveOn(env)) return false;
  const live = await readLive(env, slug);
  if (!shouldRefreshAnalog(live)) return false;
  const obs = await fetchAnalogObservation();
  const batch = buildAnalogBatch(slug, obs);
  const stub = farmStub(env, slug);
  await stub.fetch(
    new Request(`https://do/ingest?farm_id=${encodeURIComponent(slug)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(batch),
    })
  );
  return true;
}

export async function loadLiveWithAnalog(
  env: Cloudflare.Env,
  slug: string
): Promise<FarmLiveState> {
  try {
    await maybeIngestAnalog(env, slug);
  } catch (err) {
    console.error("analog ingest failed", err);
  }
  return readLive(env, slug);
}
