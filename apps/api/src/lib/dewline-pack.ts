/**
 * Dewline line packing — port of irrigation.qtech.hr scheduler.
 * Pack drip (and optional other) lines into pump main-flow so concurrent
 * L/min never exceeds capacity and the same valve box never overlaps.
 * Frost stays out of this packer (separate FPS program).
 */

export type LineType = "sprinkler" | "drip" | "bubbler" | "other";
export type FillSource = "auto" | "well" | "municipal";
export type SupplyMode = "tank" | "municipal" | "hybrid";

export type IrrigationLine = {
  lineId: string;
  valveBox: string;
  valveNumber: string;
  zone: string;
  type: LineType;
  flowM3h: number;
  durationMin: number;
};

export type SystemParams = {
  mainFlowM3h: number;
  cyclesPerDay: number;
  weeklyFactor: number;
  monthlyFactor: number;
  waterPriceEurM3: number;
  rainTankM3: number;
  catchmentM2: number;
  annualRainMm: number;
  wellRateM3h: number;
  storageTankM3: number;
  initialTankPct: number;
  refillRateM3h: number;
  fillSource: FillSource;
  supplyMode: SupplyMode;
};

export type WeatherDay = {
  date: string;
  precipMm: number;
  tempMaxC: number;
  tempMinC: number;
};

export type ScheduleSlot = {
  lineId: string;
  valveBox: string;
  valveNumber?: string;
  zone: string;
  type: LineType;
  startMin: number;
  endMin: number;
  flowM3h: number;
  volumeM3: number;
  cycle: number;
  skipped?: boolean;
  reason?: string;
};

export type FlowSegment = {
  startMin: number;
  endMin: number;
  flowM3h: number;
  lineIds: string[];
  valveBoxes: string[];
  lines: {
    lineId: string;
    valveBox: string;
    zone: string;
    type: LineType;
    flowM3h: number;
    durationMin: number;
    openMin: number;
    volumeM3: number;
    startMin: number;
    endMin: number;
  }[];
};

export type OptimizeResult = {
  slots: ScheduleSlot[];
  peakFlowM3h: number;
  totalM3Day: number;
  totalM3Week: number;
  totalM3Month: number;
  totalM3Year: number;
  rainAdjustedDays: number;
  rationale: string;
  weather: WeatherDay[];
  annualRainMm?: number;
  flowTimeline: FlowSegment[];
  mainFlowM3h: number;
};

const MORNING_START = 5 * 60;
const EVENING_START = 20 * 60;
const CYCLE_GAP_MIN = 15;
const MIN_FLOW = 0.01;

type Job = {
  line: IrrigationLine;
  duration: number;
  volume: number;
  box: string;
};

function boxKey(line: IrrigationLine): string {
  const box = (line.valveBox ?? "").trim().toUpperCase();
  return box || `__line_${line.lineId}`;
}

function adjustedDuration(
  line: IrrigationLine,
  params: SystemParams,
  weather: WeatherDay
): number {
  let mins = line.durationMin * params.weeklyFactor * params.monthlyFactor;
  if (weather.precipMm >= 5) {
    if (line.type === "sprinkler") return 0;
    if (line.type === "drip") mins *= 0.4;
    else mins *= 0.25;
  } else if (weather.precipMm >= 2) {
    if (line.type === "sprinkler") mins *= 0.35;
    else mins *= 0.7;
  } else if (weather.tempMaxC >= 32 && line.type === "sprinkler") {
    mins *= 1.1;
  }
  return Math.max(0, Math.round(mins));
}

export function lineVolumeM3(flowM3h: number, durationMin: number): number {
  return Math.round(((flowM3h * durationMin) / 60) * 1000) / 1000;
}

export function buildFlowTimeline(slots: ScheduleSlot[]): FlowSegment[] {
  const active = slots.filter(
    (s) => !s.skipped && s.endMin > s.startMin && s.flowM3h >= MIN_FLOW
  );
  if (!active.length) return [];

  const marks = new Set<number>();
  for (const s of active) {
    marks.add(s.startMin);
    marks.add(s.endMin);
  }
  const times = [...marks].sort((a, b) => a - b);
  const segments: FlowSegment[] = [];

  for (let i = 0; i < times.length - 1; i++) {
    const startMin = times[i]!;
    const endMin = times[i + 1]!;
    if (endMin <= startMin) continue;
    const mid = (startMin + endMin) / 2;
    const open = active.filter((s) => s.startMin <= mid && mid < s.endMin);
    if (!open.length) continue;
    const lines = open.map((s) => {
      const openMin = Math.min(s.endMin, endMin) - Math.max(s.startMin, startMin);
      const durationMin = s.endMin - s.startMin;
      return {
        lineId: s.lineId,
        valveBox: s.valveBox,
        zone: s.zone,
        type: s.type,
        flowM3h: s.flowM3h,
        durationMin,
        openMin,
        volumeM3: lineVolumeM3(s.flowM3h, openMin),
        startMin: s.startMin,
        endMin: s.endMin,
      };
    });
    segments.push({
      startMin,
      endMin,
      flowM3h: Math.round(lines.reduce((sum, l) => sum + l.flowM3h, 0) * 100) / 100,
      lineIds: lines.map((l) => l.lineId),
      valveBoxes: [...new Set(lines.map((l) => l.valveBox).filter(Boolean))],
      lines,
    });
  }
  return segments;
}

export function activeAt(
  slots: ScheduleSlot[],
  tMin: number
): { lines: ScheduleSlot[]; flowM3h: number; segment: FlowSegment | null } {
  const lines = slots.filter(
    (s) =>
      !s.skipped && s.flowM3h >= MIN_FLOW && s.startMin <= tMin && tMin < s.endMin
  );
  const flowM3h =
    Math.round(lines.reduce((sum, l) => sum + l.flowM3h, 0) * 100) / 100;
  const timeline = buildFlowTimeline(slots);
  const segment =
    timeline.find((seg) => seg.startMin <= tMin && tMin < seg.endMin) ?? null;
  return { lines, flowM3h, segment };
}

function packCycle(
  lines: IrrigationLine[],
  params: SystemParams,
  cycle: number,
  windowStart: number,
  weather: WeatherDay
): ScheduleSlot[] {
  const cap = Math.max(0.1, params.mainFlowM3h);
  const slots: ScheduleSlot[] = [];
  const pending: Job[] = [];

  for (const line of lines) {
    const flow = Number(line.flowM3h) || 0;
    const duration = adjustedDuration(line, params, weather);
    const volume = lineVolumeM3(flow, duration);

    if (flow < MIN_FLOW) {
      slots.push({
        lineId: line.lineId,
        valveBox: line.valveBox,
        valveNumber: line.valveNumber,
        zone: line.zone,
        type: line.type,
        startMin: windowStart,
        endMin: windowStart,
        flowM3h: flow,
        volumeM3: 0,
        cycle,
        skipped: true,
        reason: "no_flow",
      });
      continue;
    }

    if (duration <= 0) {
      slots.push({
        lineId: line.lineId,
        valveBox: line.valveBox,
        valveNumber: line.valveNumber,
        zone: line.zone,
        type: line.type,
        startMin: windowStart,
        endMin: windowStart,
        flowM3h: flow,
        volumeM3: 0,
        cycle,
        skipped: true,
        reason: "rain",
      });
      continue;
    }

    pending.push({
      line: { ...line, flowM3h: flow },
      duration,
      volume,
      box: boxKey(line),
    });
  }

  pending.sort((a, b) => b.duration - a.duration || b.line.flowM3h - a.line.flowM3h);

  type Placed = { start: number; end: number; flow: number; box: string };
  const placed: Placed[] = [];

  const intervalOk = (
    start: number,
    end: number,
    flow: number,
    box: string
  ): boolean => {
    if (end <= start) return false;
    const marks = new Set<number>([start, end]);
    for (const p of placed) {
      if (p.end <= start || p.start >= end) continue;
      marks.add(Math.max(p.start, start));
      marks.add(Math.min(p.end, end));
    }
    const times = [...marks].sort((a, b) => a - b);
    for (let i = 0; i < times.length - 1; i++) {
      const a = times[i]!;
      const b = times[i + 1]!;
      if (b <= a) continue;
      const mid = (a + b) / 2;
      let used = 0;
      for (const p of placed) {
        if (p.start <= mid && mid < p.end) {
          if (p.box === box) return false;
          used += p.flow;
        }
      }
      if (used + flow > cap + 1e-6) return false;
    }
    return true;
  };

  const earliestStart = (job: Job): number => {
    const candidates = new Set<number>([windowStart]);
    for (const p of placed) {
      candidates.add(p.end);
    }
    const sorted = [...candidates].filter((t) => t >= windowStart).sort((a, b) => a - b);
    for (const t of sorted) {
      if (intervalOk(t, t + job.duration, job.line.flowM3h, job.box)) return t;
    }
    return placed.reduce((m, p) => Math.max(m, p.end), windowStart);
  };

  while (pending.length) {
    let bestIdx = 0;
    let bestStart = earliestStart(pending[0]!);
    let bestScore = -pending[0]!.line.flowM3h * 1000 - pending[0]!.duration;

    for (let i = 1; i < pending.length; i++) {
      const job = pending[i]!;
      const start = earliestStart(job);
      const score = -job.line.flowM3h * 1000 - job.duration;
      if (start < bestStart - 1e-9 || (Math.abs(start - bestStart) < 1e-9 && score < bestScore)) {
        bestIdx = i;
        bestStart = start;
        bestScore = score;
      }
    }

    const [job] = pending.splice(bestIdx, 1);
    if (!job) break;
    let start = bestStart;
    if (!intervalOk(start, start + job.duration, job.line.flowM3h, job.box)) {
      start = placed.reduce((m, p) => Math.max(m, p.end), windowStart);
    }
    const end = start + job.duration;
    placed.push({ start, end, flow: job.line.flowM3h, box: job.box });
    slots.push({
      lineId: job.line.lineId,
      valveBox: job.line.valveBox,
      valveNumber: job.line.valveNumber,
      zone: job.line.zone,
      type: job.line.type,
      startMin: start,
      endMin: end,
      flowM3h: job.line.flowM3h,
      volumeM3: job.volume,
      cycle,
    });
  }

  const live = slots.filter((s) => !s.skipped && s.endMin > s.startMin);
  live.sort((a, b) => a.startMin - b.startMin || a.lineId.localeCompare(b.lineId));

  for (let pass = 0; pass < 3; pass++) {
    for (const s of live) {
      const dur = s.endMin - s.startMin;
      const box = (s.valveBox ?? "").trim().toUpperCase() || `__line_${s.lineId}`;
      const others: Placed[] = live
        .filter((o) => o !== s)
        .map((o) => ({
          start: o.startMin,
          end: o.endMin,
          flow: o.flowM3h,
          box: (o.valveBox ?? "").trim().toUpperCase() || `__line_${o.lineId}`,
        }));

      const marks = new Set<number>([windowStart]);
      for (const o of others) marks.add(o.end);
      const candidates = [...marks]
        .filter((t) => t >= windowStart && t <= s.startMin)
        .sort((a, b) => a - b);

      const fits = (t0: number) => {
        const end = t0 + dur;
        const pts = new Set<number>([t0, end]);
        for (const p of others) {
          if (p.end <= t0 || p.start >= end) continue;
          pts.add(Math.max(p.start, t0));
          pts.add(Math.min(p.end, end));
        }
        const times = [...pts].sort((a, b) => a - b);
        for (let i = 0; i < times.length - 1; i++) {
          const a = times[i]!;
          const b = times[i + 1]!;
          if (b <= a) continue;
          const mid = (a + b) / 2;
          let used = 0;
          for (const p of others) {
            if (p.start <= mid && mid < p.end) {
              if (p.box === box) return false;
              used += p.flow;
            }
          }
          if (used + s.flowM3h > cap + 1e-6) return false;
        }
        return true;
      };

      for (const t of candidates) {
        if (t >= s.startMin) break;
        if (fits(t)) {
          s.startMin = t;
          s.endMin = t + dur;
          break;
        }
      }
    }
    live.sort((a, b) => a.startMin - b.startMin || a.lineId.localeCompare(b.lineId));
  }

  return slots;
}

function preferredWindows(cycles: number): number[] {
  if (cycles === 1) return [MORNING_START];
  if (cycles === 2) return [MORNING_START, EVENING_START];
  if (cycles === 3) return [MORNING_START, 12 * 60, EVENING_START];
  return [4 * 60, MORNING_START, 14 * 60, EVENING_START];
}

export function buildSchedule(
  lines: IrrigationLine[],
  params: SystemParams,
  weather: WeatherDay[],
  rationale: string
): OptimizeResult {
  const today = weather[0] ?? {
    date: new Date().toISOString().slice(0, 10),
    precipMm: 0,
    tempMaxC: 24,
    tempMinC: 14,
  };

  const cycles = Math.max(1, Math.min(4, Math.round(params.cyclesPerDay)));
  const windows = preferredWindows(cycles);

  const slots: ScheduleSlot[] = [];
  let earliestNext = 0;

  for (let c = 0; c < cycles; c++) {
    const preferred = windows[c] ?? MORNING_START;
    const start = Math.max(preferred, earliestNext);
    const cycleSlots = packCycle(lines, params, c + 1, start, today);
    slots.push(...cycleSlots);
    const cycleEnd = cycleSlots.reduce((m, s) => Math.max(m, s.endMin), start);
    earliestNext = cycleEnd + CYCLE_GAP_MIN;
  }

  const flowTimeline = buildFlowTimeline(slots);
  const dayVolume = slots.reduce((s, x) => s + x.volumeM3, 0);
  const peak = flowTimeline.reduce((m, seg) => Math.max(m, seg.flowM3h), 0);

  const rainDays = weather.filter((w) => w.precipMm >= 2).length;
  const dryFactor = Math.max(0.35, 1 - (rainDays / Math.max(weather.length, 1)) * 0.55);
  const week = dayVolume * 7 * dryFactor;
  const month = dayVolume * 30 * dryFactor;
  const year = dayVolume * 200 * dryFactor;

  return {
    slots,
    peakFlowM3h: Math.round(peak * 100) / 100,
    totalM3Day: Math.round(dayVolume * 100) / 100,
    totalM3Week: Math.round(week * 100) / 100,
    totalM3Month: Math.round(month * 100) / 100,
    totalM3Year: Math.round(year * 100) / 100,
    rainAdjustedDays: rainDays,
    rationale,
    weather,
    annualRainMm: params.annualRainMm,
    flowTimeline,
    mainFlowM3h: params.mainFlowM3h,
  };
}
