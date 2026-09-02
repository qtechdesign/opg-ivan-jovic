/**
 * Dewline pond/tank day sim + rain/well vs municipal savings.
 * Storage here is the farm pond (usable m³), not a plastic tank.
 */

import {
  activeAt,
  type OptimizeResult,
  type SystemParams,
} from "./dewline-pack";
import { ANALOG_RAIN_MM } from "./water-budget";

export type TankSimState = {
  levelM3: number;
  fillPct: number;
  rainLevelM3: number;
  fromTankM3: number;
  fromMunicipalM3: number;
  fromRainM3: number;
  fromWellM3: number;
  fromMuniFillM3: number;
  refilledM3: number;
  refillActive: boolean;
  refillSource: "rain" | "well" | "municipal" | "none";
  fillLeg: "well" | "municipal" | "none";
  supplyActive: "tank" | "municipal" | "both" | "none";
  starved: boolean;
};

export type TankSimOpts = {
  capacityM3: number;
  initialPct: number;
  refillRateM3h: number;
  rainTankM3: number;
  catchmentM2: number;
  wellRateM3h: number;
  todayPrecipMm: number;
  refillValveOpen: boolean;
  refillOnlyWhenIdle: boolean;
  fillSource: SystemParams["fillSource"];
  supplyMode: SystemParams["supplyMode"];
  startMin: number;
  endMin: number;
};

export type TankSample = {
  t_min: number;
  fill_pct: number;
  level_m3: number;
  flow_m3h: number;
  starved: boolean;
};

export type FreeWaterBreakdown = {
  annualRainMm: number;
  rainHarvestM3: number;
  wellHarvestM3: number;
  freeWaterM3: number;
  yearM3: number;
  coveredM3: number;
  municipalM3: number;
  municipalCostEur: number;
  freeScenarioCostEur: number;
  savedEur: number;
  savedPct: number;
};

export function defaultTankOpts(
  params: SystemParams,
  startMin = 0,
  endMin = 24 * 60
): TankSimOpts {
  return {
    capacityM3: Math.max(0.001, params.storageTankM3 || 0),
    initialPct: Math.min(100, Math.max(0, params.initialTankPct ?? 80)),
    refillRateM3h: Math.max(0, params.refillRateM3h ?? 0),
    rainTankM3: Math.max(0, params.rainTankM3 ?? 0),
    catchmentM2: Math.max(0, params.catchmentM2 ?? 0),
    wellRateM3h: Math.max(0, params.wellRateM3h ?? 0),
    todayPrecipMm: 0,
    refillValveOpen: true,
    refillOnlyWhenIdle: true,
    fillSource: params.fillSource ?? "auto",
    supplyMode: params.supplyMode ?? "tank",
    startMin,
    endMin,
  };
}

export function tankStateAt(
  result: OptimizeResult | null,
  tMin: number,
  opts: TankSimOpts
): TankSimState {
  const capacity = Math.max(0.001, opts.capacityM3);
  let level = (capacity * opts.initialPct) / 100;
  let rainLevel = Math.min(
    opts.rainTankM3,
    (opts.catchmentM2 * opts.todayPrecipMm * 0.8) / 1000
  );
  let fromTank = 0;
  let fromMunicipal = 0;
  let fromRain = 0;
  let fromWell = 0;
  let fromMuniFill = 0;
  let refilled = 0;
  let lastRefill = false;
  let lastRefillSource: TankSimState["refillSource"] = "none";
  let lastFillLeg: TankSimState["fillLeg"] = "none";
  let lastSupply: TankSimState["supplyActive"] = "none";
  let starved = false;

  if (!result) {
    return {
      levelM3: round3(level),
      fillPct: (level / capacity) * 100,
      rainLevelM3: round3(rainLevel),
      fromTankM3: 0,
      fromMunicipalM3: 0,
      fromRainM3: 0,
      fromWellM3: 0,
      fromMuniFillM3: 0,
      refilledM3: 0,
      refillActive: false,
      refillSource: "none",
      fillLeg: "none",
      supplyActive: "none",
      starved: false,
    };
  }

  const precip =
    opts.todayPrecipMm > 0 ? opts.todayPrecipMm : (result.weather?.[0]?.precipMm ?? 0);
  if (opts.todayPrecipMm <= 0 && precip > 0) {
    rainLevel = Math.min(opts.rainTankM3, (opts.catchmentM2 * precip * 0.8) / 1000);
  }

  const allowWell = opts.fillSource === "well" || opts.fillSource === "auto";
  const allowMuni = opts.fillSource === "municipal" || opts.fillSource === "auto";

  const from = opts.startMin;
  const to = Math.max(from, Math.min(tMin, opts.endMin));
  const step = 1;

  for (let t = from; t < to; t += step) {
    const live = activeAt(result.slots, t + 0.5);
    const demand = (live.flowM3h * step) / 60;
    const idle = live.flowM3h < 0.01;

    let tookTank = 0;
    let tookMuni = 0;

    if (demand > 0) {
      if (opts.supplyMode === "municipal") {
        tookMuni = demand;
      } else if (opts.supplyMode === "tank") {
        tookTank = Math.min(level, demand);
        tookMuni = demand - tookTank;
        if (tookMuni > 1e-6) starved = true;
      } else {
        tookTank = Math.min(level, demand);
        tookMuni = demand - tookTank;
      }
      level -= tookTank;
      fromTank += tookTank;
      fromMunicipal += tookMuni;
    }

    const room = capacity - level;
    const canRefill =
      opts.refillValveOpen && room > 1e-9 && (!opts.refillOnlyWhenIdle || idle);

    let addRain = 0;
    let addWell = 0;
    let addMuni = 0;
    let source: TankSimState["refillSource"] = "none";
    let fillLeg: TankSimState["fillLeg"] = "none";

    if (canRefill) {
      let need = room;

      if (need > 1e-9 && rainLevel > 1e-9 && opts.rainTankM3 > 0) {
        const rainRate = Math.max(opts.refillRateM3h, opts.wellRateM3h, 5);
        addRain = Math.min((rainRate * step) / 60, rainLevel, need);
        rainLevel -= addRain;
        need -= addRain;
        if (addRain > 1e-9) source = "rain";
      }

      if (need > 1e-9 && allowWell && opts.wellRateM3h > 0) {
        addWell = Math.min((opts.wellRateM3h * step) / 60, need);
        need -= addWell;
        if (addWell > 1e-9) {
          source = source === "none" ? "well" : source;
          fillLeg = "well";
        }
      }

      const wellShort =
        opts.fillSource === "auto" &&
        (opts.wellRateM3h <= 0 || addWell + 1e-9 < room - addRain);
      const useMuni =
        allowMuni &&
        opts.refillRateM3h > 0 &&
        (opts.fillSource === "municipal" ||
          wellShort ||
          (opts.fillSource === "auto" && need > 1e-9));

      if (need > 1e-9 && useMuni) {
        addMuni = Math.min((opts.refillRateM3h * step) / 60, need);
        if (addMuni > 1e-9) {
          if (source === "none") source = "municipal";
          if (fillLeg === "none") fillLeg = "municipal";
        }
      }

      const add = addRain + addWell + addMuni;
      level += add;
      refilled += add;
      fromRain += addRain;
      fromWell += addWell;
      fromMuniFill += addMuni;
      lastRefill = add > 1e-9;
      lastRefillSource = source;
      lastFillLeg = fillLeg;
    } else {
      lastRefill = false;
      lastRefillSource = "none";
      lastFillLeg = "none";
    }

    if (tookTank > 1e-9 && tookMuni > 1e-9) lastSupply = "both";
    else if (tookTank > 1e-9) lastSupply = "tank";
    else if (tookMuni > 1e-9) lastSupply = "municipal";
    else lastSupply = "none";
  }

  return {
    levelM3: round3(level),
    fillPct: Math.max(0, Math.min(100, (level / capacity) * 100)),
    rainLevelM3: round3(rainLevel),
    fromTankM3: round2(fromTank),
    fromMunicipalM3: round2(fromMunicipal),
    fromRainM3: round2(fromRain),
    fromWellM3: round2(fromWell),
    fromMuniFillM3: round2(fromMuniFill),
    refilledM3: round2(refilled),
    refillActive: lastRefill,
    refillSource: lastRefillSource,
    fillLeg: lastFillLeg,
    supplyActive: lastSupply,
    starved,
  };
}

/** 10-minute samples for the Water page clock. */
export function tankSeries(
  result: OptimizeResult,
  opts: TankSimOpts,
  stepMin = 10
): TankSample[] {
  const out: TankSample[] = [];
  for (let t = 0; t <= 24 * 60; t += stepMin) {
    const live = activeAt(result.slots, t);
    const st = tankStateAt(result, t, { ...opts, todayPrecipMm: opts.todayPrecipMm });
    out.push({
      t_min: t,
      fill_pct: round1(st.fillPct),
      level_m3: st.levelM3,
      flow_m3h: live.flowM3h,
      starved: st.starved,
    });
  }
  return out;
}

/**
 * Annual rain + well vs a full municipal bill.
 * Rain uses climate analog mm — never a dry 7-day forecast alone.
 */
export function computeSavings(
  result: OptimizeResult | null,
  params: SystemParams
): FreeWaterBreakdown | null {
  if (!result) return null;

  const yearM3 = Math.max(0, result.totalM3Year);
  const price = Math.max(0, params.waterPriceEurM3);
  const annualRainMm = Math.max(
    0,
    result.annualRainMm ?? params.annualRainMm ?? ANALOG_RAIN_MM
  );

  const catchmentM2 = Math.max(0, params.catchmentM2);
  const rainTankM3 = Math.max(0, params.rainTankM3);
  const rawRain = (catchmentM2 * annualRainMm * 0.8) / 1000;
  const rainHarvestM3 = Math.min(rainTankM3 * 40, rawRain);

  const wellRate = Math.max(0, params.wellRateM3h ?? 0);
  const wellHarvestM3 = wellRate * 4 * 180;

  const freeWaterM3 = rainHarvestM3 + wellHarvestM3;
  const coveredM3 = Math.min(yearM3, freeWaterM3);
  const municipalM3 = Math.max(0, yearM3 - coveredM3);
  const municipalCostEur = yearM3 * price;
  const freeScenarioCostEur = municipalM3 * price;
  const savedEur = Math.max(0, municipalCostEur - freeScenarioCostEur);
  const savedPct = municipalCostEur > 0 ? (savedEur / municipalCostEur) * 100 : 0;

  return {
    annualRainMm,
    rainHarvestM3,
    wellHarvestM3,
    freeWaterM3,
    yearM3,
    coveredM3,
    municipalM3,
    municipalCostEur,
    freeScenarioCostEur,
    savedEur,
    savedPct,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
