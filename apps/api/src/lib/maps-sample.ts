/** Google Maps Environment APIs — click-to-sample on /land. Key stays on the Worker. */

export type MapsSampleOk = {
  lat: number;
  lon: number;
  elevation_m: number | null;
  elevation_error?: string;
  air: { aqi: number | null; category: string | null; pollutant: string | null; error?: string };
  pollen: { summary: string | null; error?: string };
  weather: { temp_c: number | null; condition: string | null; humidity: number | null; error?: string };
};

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}

async function googleJson(
  url: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Referer")) {
    headers.set("Referer", "https://opg-ivanjovic.hr/");
  }
  const res = await fetch(url, {
    ...init,
    headers,
    signal: AbortSignal.timeout(8000),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, data };
}

function googleErr(data: Record<string, unknown>, fallback: string): string {
  const err = data.error as { message?: string; status?: string } | undefined;
  if (err?.message) return String(err.message).slice(0, 180);
  if (typeof data.status === "string" && data.status !== "OK") {
    return String(data.error_message || data.status).slice(0, 180);
  }
  return fallback;
}

export async function sampleMapsPoint(
  key: string,
  lat: number,
  lon: number,
  lang: "en" | "hr"
): Promise<MapsSampleOk> {
  const q = encodeURIComponent(key);
  const language = lang === "hr" ? "hr" : "en";

  const elevUrl =
    `https://maps.googleapis.com/maps/api/elevation/json?locations=${lat},${lon}&key=${q}`;
  const weatherUrl =
    `https://weather.googleapis.com/v1/currentConditions:lookup?key=${q}` +
    `&location.latitude=${lat}&location.longitude=${lon}&languageCode=${language}`;
  const pollenUrl =
    `https://pollen.googleapis.com/v1/forecast:lookup?key=${q}` +
    `&location.latitude=${lat}&location.longitude=${lon}&days=1&languageCode=${language}`;
  const airUrl =
    `https://airquality.googleapis.com/v1/currentConditions:lookup?key=${q}`;

  const [elev, weather, pollen, air] = await Promise.all([
    googleJson(elevUrl),
    googleJson(weatherUrl),
    googleJson(pollenUrl),
    googleJson(airUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: { latitude: lat, longitude: lon },
        languageCode: language,
      }),
    }),
  ]);

  let elevation_m: number | null = null;
  let elevation_error: string | undefined;
  if (elev.data.status === "OK") {
    const results = elev.data.results as Array<{ elevation?: number }> | undefined;
    elevation_m = num(results?.[0]?.elevation);
    if (elevation_m != null) elevation_m = Math.round(elevation_m * 10) / 10;
  } else {
    elevation_error = googleErr(elev.data, `elevation_${elev.status}`);
  }

  const airOut: MapsSampleOk["air"] = { aqi: null, category: null, pollutant: null };
  if (!air.ok) {
    airOut.error = googleErr(air.data, `air_${air.status}`);
  } else {
    const indexes = air.data.indexes as
      | Array<{
          aqi?: number;
          category?: string;
          dominantPollutant?: string;
        }>
      | undefined;
    const ua = indexes?.[0];
    airOut.aqi = num(ua?.aqi);
    airOut.category = str(ua?.category);
    airOut.pollutant = str(ua?.dominantPollutant);
  }

  const pollenOut: MapsSampleOk["pollen"] = { summary: null };
  if (!pollen.ok) {
    pollenOut.error = googleErr(pollen.data, `pollen_${pollen.status}`);
  } else {
    const daily = pollen.data.dailyInfo as
      | Array<{
          pollenTypeInfo?: Array<{
            displayName?: string;
            indexInfo?: { category?: string; value?: number };
          }>;
        }>
      | undefined;
    const types = daily?.[0]?.pollenTypeInfo ?? [];
    const bits = types
      .map((p) => {
        const name = str(p.displayName);
        const cat = str(p.indexInfo?.category);
        if (!name || !cat) return null;
        return `${name} ${cat}`;
      })
      .filter(Boolean);
    pollenOut.summary = bits.length ? bits.join(" · ") : "—";
  }

  const weatherOut: MapsSampleOk["weather"] = {
    temp_c: null,
    condition: null,
    humidity: null,
  };
  if (!weather.ok) {
    weatherOut.error = googleErr(weather.data, `weather_${weather.status}`);
  } else {
    const temp = weather.data.temperature as { degrees?: number } | undefined;
    const cond = weather.data.weatherCondition as
      | { description?: { text?: string } }
      | undefined;
    weatherOut.temp_c = num(temp?.degrees);
    weatherOut.condition = str(cond?.description?.text);
    weatherOut.humidity = num(weather.data.relativeHumidity);
  }

  return {
    lat,
    lon,
    elevation_m,
    air: airOut,
    pollen: pollenOut,
    weather: weatherOut,
    ...(elevation_error ? { elevation_error } : {}),
  };
}
