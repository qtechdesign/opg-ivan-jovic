export type Solar = "dawn" | "day" | "dusk" | "night";
export type Wx = "clear" | "cloud" | "rain" | "snow" | "frost" | "fog";

export function hourInZone(timeZone: string, at = new Date()): number {
  try {
    const hour = Number(
      new Intl.DateTimeFormat("en-GB", {
        timeZone,
        hour: "2-digit",
        hourCycle: "h23",
      }).format(at)
    );
    return Number.isFinite(hour) ? hour : at.getUTCHours();
  } catch {
    return at.getUTCHours();
  }
}

export function solarFromHour(hour: number): Solar {
  if (hour >= 5 && hour < 8) return "dawn";
  if (hour >= 8 && hour < 18) return "day";
  if (hour >= 18 && hour < 21) return "dusk";
  return "night";
}

type LiveLike = {
  frost?: string;
  metrics?: Record<
    string,
    { metric?: string; value?: number; device_id?: string }
  >;
};

function metricValue(
  metrics: LiveLike["metrics"],
  names: string[]
): number | null {
  if (!metrics) return null;
  for (const m of Object.values(metrics)) {
    if (m && names.includes(String(m.metric)) && typeof m.value === "number") {
      return m.value;
    }
  }
  return null;
}

export function wxFromLive(live: LiveLike | null | undefined): Wx {
  const frost = live?.frost;
  if (frost === "armed" || frost === "spraying" || frost === "watch") {
    return "frost";
  }
  const temp = metricValue(live?.metrics, ["temp_c"]);
  const rh = metricValue(live?.metrics, ["rh", "humidity"]);
  if (rh != null && rh >= 92 && temp != null && temp < 8) return "fog";
  return "clear";
}

export function liveTempC(live: LiveLike | null | undefined): number | null {
  return metricValue(live?.metrics, ["temp_c"]);
}

export function weatherNow(
  timeZone: string,
  live: LiveLike | null | undefined,
  at = new Date()
): {
  solar: Solar;
  wx: Wx;
  temp_c: number | null;
  updated_at: string;
} {
  return {
    solar: solarFromHour(hourInZone(timeZone, at)),
    wx: wxFromLive(live),
    temp_c: liveTempC(live),
    updated_at: at.toISOString(),
  };
}
