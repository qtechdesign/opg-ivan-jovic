/**
 * Dewline 2:1 isometric farm model on /water.
 * Plate, excavated pond (true metres), pump, pipes, drip bed, person, callouts.
 */

export const POND_PREVIEW_JS = `
    (function () {
      const canvas = document.getElementById("pond-canvas");
      if (!canvas || !canvas.getContext) return;
      const ctx = canvas.getContext("2d");
      const depthEl = document.getElementById("pond-depth");
      const slopeEl = document.getElementById("pond-slope");
      const catchEl = document.getElementById("pond-catch");
      const saveBtn = document.getElementById("pond-save");
      let TILE_W = 40;
      let TILE_H = 20;
      let isoS = 1;
      const FREEBOARD = 0.3;
      const RAIN_MM = 880;
      const EVAP_MM = 1000;
      const RUNOFF = 0.35;
      const rain = [];
      let ox = 640;
      let oy = 330;
      let pond = null;
      let budget = null;
      let example = false;
      let pack = null;
      let tMin = 5 * 60;
      let saveTimer = null;

      function num(el, fallback) {
        if (!el) return fallback;
        const n = Number(el.value);
        return Number.isFinite(n) ? n : fallback;
      }
      function clamp(n, lo, hi) {
        if (!Number.isFinite(n)) return lo;
        return Math.min(hi, Math.max(lo, n));
      }
      function round1(n) { return Math.round(n * 10) / 10; }
      function round2(n) { return Math.round(n * 100) / 100; }
      function night() {
        const s = document.documentElement.getAttribute("data-solar") || "day";
        return s === "night" || s === "dusk" || s === "dawn";
      }
      function pal() {
        if (night()) {
          return {
            sky0: "#11303c", sky1: "#102a26", sky2: "#0e2420",
            glow: "rgba(96,200,206,0.18)",
            ao: "rgba(0,0,0,0.34)",
            grid: "rgba(214,255,235,0.12)",
            edge: "rgba(0,0,0,0.28)",
            ink: "rgba(240,248,246,0.92)",
            mute: "rgba(180,210,200,0.75)",
            chip: "rgba(12,24,22,0.82)",
            ground: { t: "#2c6349", l: "#143d2b", r: "#1f4f38" },
            path: { t: "#616d66", l: "#333c37", r: "#49544d" },
            lawn: { t: "#3d8558", l: "#1f5138", r: "#2c6a47" },
            drip: { t: "#746041", l: "#3f3427", r: "#574834" },
            frost: { t: "#6a8a96", l: "#2c4a54", r: "#3d6470" },
            leaf: { t: "#3f8a5e", l: "#1f5238", r: "#2e6b48" },
            leafHi: { t: "#4f9f6d", l: "#275e42", r: "#367a54" },
            trunk: { t: "#6f5439", l: "#3c2e20", r: "#53402c" },
            soil: { t: "#8a6a48", l: "#4a3624", r: "#634a32" },
            steel: { t: "#a0b1bb", l: "#55636b", r: "#77868f" },
            tank: { t: "#dae5eb", l: "#7d8e99", r: "#a9b9c2" },
            poolT: "#8fdcf0", poolB: "#2a7a99",
            pipe: "#6c7f89", pipeLive: "#4ec3e0",
            person: { t: "#cdb98f", l: "#6e6249", r: "#9c8d6b" }
          };
        }
        return {
          sky0: "#dceff7", sky1: "#e9f6ef", sky2: "#f2f8e9",
          glow: "rgba(255,238,196,0.45)",
          ao: "rgba(16,36,25,0.13)",
          grid: "rgba(16,36,25,0.08)",
          edge: "rgba(16,36,25,0.08)",
          ink: "rgba(16,28,24,0.88)",
          mute: "rgba(16,36,25,0.55)",
          chip: "rgba(255,255,255,0.88)",
          ground: { t: "#cdebd6", l: "#8cc79e", r: "#a6d8b4" },
          path: { t: "#f0ece0", l: "#cdc5b2", r: "#e0d9c8" },
          lawn: { t: "#cff3d2", l: "#7fd196", r: "#a0e4b0" },
          drip: { t: "#e9d9b8", l: "#c0a078", r: "#d6ba95" },
          frost: { t: "#d5eef4", l: "#8bb8c6", r: "#b3d6e0" },
          leaf: { t: "#a6dfb4", l: "#5cb477", r: "#7cc993" },
          leafHi: { t: "#c2eecb", l: "#74c48c", r: "#95d9a8" },
          trunk: { t: "#cfae8c", l: "#9a7550", r: "#b18f67" },
          soil: { t: "#d7b48a", l: "#a07a4e", r: "#c19662" },
          steel: { t: "#dee8ee", l: "#93a7b3", r: "#aec0c9" },
          tank: { t: "#f9fbfc", l: "#c4d3db", r: "#dbe5eb" },
          poolT: "#bff2ff", poolB: "#4aa8c8",
          pipe: "#9fb0ba", pipeLive: "#4ec3e0",
          person: { t: "#fff4de", l: "#e5cfa3", r: "#f3e3bc" }
        };
      }

      function pondGeom(areaM2, depthM, bankSlope) {
        const area = Math.max(0, areaM2);
        const depth = clamp(depthM, 0.4, 8);
        const slope = clamp(bankSlope, 1, 6);
        if (area < 4) {
          return { area_m2: area, depth_m: depth, bank_slope: slope, bottom_m2: 0, volume_m3: 0, usable_m3: 0, too_steep: area > 0, side_top: 0, side_bot: 0, inset: 0 };
        }
        const sideTop = Math.sqrt(area);
        const inset = depth * slope;
        let sideBot = sideTop - 2 * inset;
        let too_steep = false;
        if (sideBot < 0.8) { too_steep = true; sideBot = 0.8; }
        const bottom = sideBot * sideBot;
        const volume = (depth / 3) * (area + bottom + Math.sqrt(area * bottom));
        const liveFrac = Math.max(0.35, (depth - FREEBOARD) / depth);
        return {
          area_m2: round1(area),
          depth_m: round2(depth),
          bank_slope: round2(slope),
          bottom_m2: round1(bottom),
          volume_m3: round1(volume),
          usable_m3: round1(volume * liveFrac * 0.92),
          too_steep: too_steep,
          side_top: round1(sideTop),
          side_bot: round1(sideBot),
          inset: round1(inset)
        };
      }
      function pondYield(areaM2, factor) {
        const a = Math.max(0, areaM2);
        const f = clamp(factor, 1, 40);
        const rainOn = (a * RAIN_MM) / 1000;
        const evap = (a * EVAP_MM) / 1000;
        const extra = a * Math.max(0, f - 1);
        const catchM3 = (extra * RAIN_MM * RUNOFF) / 1000;
        return { rain_on_pond_m3: round1(rainOn), evap_m3: round1(evap), catchment_m3: round1(catchM3), net_m3: round1(rainOn - evap + catchM3) };
      }

      function gx(u, v) { return ox + (u - v) * TILE_W; }
      function gy(u, v) { return oy + (u + v) * TILE_H; }

      function isoBox(x, y, w, d, h, f, ao) {
        w *= isoS;
        d *= isoS;
        h *= isoS;
        if (ao) {
          ctx.fillStyle = pal().ao;
          ctx.beginPath();
          ctx.ellipse(x, y, w * 1.05, d * 1.05, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.beginPath();
        ctx.moveTo(x - w, y - h);
        ctx.lineTo(x, y - h + d);
        ctx.lineTo(x, y + d);
        ctx.lineTo(x - w, y);
        ctx.closePath();
        ctx.fillStyle = f.l;
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x + w, y - h);
        ctx.lineTo(x, y - h + d);
        ctx.lineTo(x, y + d);
        ctx.lineTo(x + w, y);
        ctx.closePath();
        ctx.fillStyle = f.r;
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x - w, y - h);
        ctx.lineTo(x, y - h - d);
        ctx.lineTo(x + w, y - h);
        ctx.lineTo(x, y - h + d);
        ctx.closePath();
        ctx.fillStyle = f.t;
        ctx.fill();
      }

      function isoSlab(u0, u1, v0, v1, f, depth) {
        depth *= isoS;
        const a = [gx(u0, v0), gy(u0, v0)];
        const b = [gx(u1, v0), gy(u1, v0)];
        const c = [gx(u1, v1), gy(u1, v1)];
        const d = [gx(u0, v1), gy(u0, v1)];
        ctx.beginPath();
        ctx.moveTo(d[0], d[1]);
        ctx.lineTo(c[0], c[1]);
        ctx.lineTo(c[0], c[1] + depth);
        ctx.lineTo(d[0], d[1] + depth);
        ctx.closePath();
        ctx.fillStyle = f.l;
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(c[0], c[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.lineTo(b[0], b[1] + depth);
        ctx.lineTo(c[0], c[1] + depth);
        ctx.closePath();
        ctx.fillStyle = f.r;
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.lineTo(c[0], c[1]);
        ctx.lineTo(d[0], d[1]);
        ctx.closePath();
        ctx.fillStyle = f.t;
        ctx.fill();
      }

      function isoTree(x, y, s) {
        const P = pal();
        ctx.fillStyle = P.ao;
        ctx.beginPath();
        ctx.ellipse(x, y, 16 * s * isoS, 7 * s * isoS, 0, 0, Math.PI * 2);
        ctx.fill();
        isoBox(x, y, 3.4 * s, 1.7 * s, 17 * s, P.trunk);
        isoBox(x, y - 17 * s, 16 * s, 8 * s, 8 * s, P.leaf);
        isoBox(x - 3 * s, y - 28 * s, 11 * s, 5.5 * s, 6 * s, P.leafHi);
      }

      function isoPerson(x, y, pxPerM) {
        const P = pal();
        const h = 1.8 * pxPerM;
        const w = 0.28 * pxPerM * 40 / 22;
        const d = w * 0.5;
        isoBox(x, y, w, d, h * 0.55, P.person, true);
        isoBox(x, y - h * 0.55, w * 0.7, d * 0.7, h * 0.28, P.person);
        ctx.beginPath();
        ctx.ellipse(x, y - h * 0.92, w * 0.55, w * 0.55, 0, 0, Math.PI * 2);
        ctx.fillStyle = P.person.t;
        ctx.fill();
      }

      function pipe(cells, live, width) {
        const P = pal();
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.beginPath();
        cells.forEach(function (c, i) {
          const x = gx(c[0], c[1]);
          const y = gy(c[0], c[1]);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = "rgba(16,36,25,0.12)";
        ctx.lineWidth = (width + 3) * isoS;
        ctx.stroke();
        ctx.strokeStyle = live ? P.pipeLive : P.pipe;
        ctx.lineWidth = width * isoS;
        ctx.stroke();
      }

      function callout(ax, ay, label, live) {
        const P = pal();
        const cw = canvas.clientWidth || 640;
        const w = Math.max(56, 18 + label.length * 6.2);
        let cx = ax + 28;
        let cy = ay - 26;
        if (cx + w > cw - 8) cx = Math.max(8, ax - w - 10);
        if (cx < 8) cx = 8;
        if (cy < 8) cy = ay + 10;
        ctx.strokeStyle = live ? P.pipeLive : P.mute;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(cx + (ax > cx ? w : 0), cy + 9);
        ctx.stroke();
        ctx.fillStyle = P.chip;
        roundRect(cx, cy, w, 18, 6);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + 9, cy + 9, 2.6, 0, Math.PI * 2);
        ctx.fillStyle = live ? P.pipeLive : P.mute;
        ctx.fill();
        ctx.fillStyle = P.ink;
        ctx.font = "600 10px IBM Plex Sans, ui-sans-serif, sans-serif";
        ctx.fillText(label, cx + 16, cy + 12.5);
      }

      function roundRect(x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
      }

      function design() {
        const depth = num(depthEl, pond && pond.depth_m != null ? pond.depth_m : 2.2);
        const slope = num(slopeEl, pond && pond.bank_slope != null ? pond.bank_slope : 2.5);
        const catchF = num(catchEl, pond && pond.catchment_factor != null ? pond.catchment_factor : 4);
        const ha = pond && pond.hectares != null && pond.hectares > 0 ? pond.hectares : (example ? 0.0625 : 0);
        const area = ha * 10000;
        const geom = pondGeom(area, depth, slope);
        const yld = pondYield(area, catchF);
        return { depth: depth, slope: slope, catchF: catchF, ha: ha, area: area, geom: geom, yld: yld };
      }

      function fillPct() {
        if (pack && pack.tank_series && pack.tank_series.length && pack.params && pack.params.storage_m3 > 0) {
          let best = pack.tank_series[0];
          for (let i = 0; i < pack.tank_series.length; i++) {
            if (pack.tank_series[i].t_min <= tMin) best = pack.tank_series[i];
            else break;
          }
          return clamp(best.fill_pct / 100, 0.04, 1);
        }
        if (pond && pond.fill_pct != null) return clamp(Number(pond.fill_pct) / 100, 0.04, 1);
        return 0.72;
      }

      function dripOn() {
        if (!pack || !pack.slots) return false;
        return pack.slots.some(function (s) {
          return !s.skipped && s.startMin <= tMin && tMin < s.endMin;
        });
      }

      function flowNow() {
        if (!pack || !pack.slots) return 0;
        return pack.slots.reduce(function (sum, s) {
          if (!s.skipped && s.startMin <= tMin && tMin < s.endMin) return sum + (s.flowM3h || 0);
          return sum;
        }, 0);
      }

      function resize() {
        const w = canvas.clientWidth || 640;
        const h = canvas.clientHeight || 280;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const plateW = 28.8 * 40;
        isoS = Math.min(1.05, (w * 0.92) / plateW);
        TILE_W = 40 * isoS;
        TILE_H = 20 * isoS;
        ox = w * 0.5;
        oy = h * 0.58;
      }

      function spawnRain(n) {
        const w = canvas.clientWidth || 640;
        const h = canvas.clientHeight || 420;
        rain.length = 0;
        for (let i = 0; i < n; i++) {
          rain.push({ x: Math.random() * w, y: Math.random() * h, v: 1.6 + Math.random() * 2, len: 5 + Math.random() * 7 });
        }
      }

      function draw(now) {
        const w = canvas.clientWidth || 640;
        const h = canvas.clientHeight || 420;
        const P = pal();
        const d = design();
        const g = d.geom;
        const fill = fillPct();
        const live = dripOn();
        const flow = flowNow();
        now = now || performance.now();

        const sky = ctx.createLinearGradient(0, 0, 0, h);
        sky.addColorStop(0, P.sky0);
        sky.addColorStop(0.46, P.sky1);
        sky.addColorStop(1, P.sky2);
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = P.glow;
        ctx.beginPath();
        ctx.ellipse(w * 0.5, h * 0.22, w * 0.42, h * 0.16, 0, 0, Math.PI * 2);
        ctx.fill();

        isoSlab(-7.2, 7.2, -7.2, 7.2, P.ground, 14);

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(gx(-7.2, -7.2), gy(-7.2, -7.2));
        ctx.lineTo(gx(7.2, -7.2), gy(7.2, -7.2));
        ctx.lineTo(gx(7.2, 7.2), gy(7.2, 7.2));
        ctx.lineTo(gx(-7.2, 7.2), gy(-7.2, 7.2));
        ctx.closePath();
        ctx.clip();
        ctx.strokeStyle = P.grid;
        ctx.lineWidth = 1;
        for (let u = -7; u <= 7; u++) {
          ctx.beginPath();
          ctx.moveTo(gx(u, -7.2), gy(u, -7.2));
          ctx.lineTo(gx(u, 7.2), gy(u, 7.2));
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(gx(-7.2, u), gy(-7.2, u));
          ctx.lineTo(gx(7.2, u), gy(7.2, u));
          ctx.stroke();
        }
        ctx.restore();

        const catchSide = Math.sqrt(Math.max(d.area, 1) * d.catchF);
        const mPerTile = Math.max(catchSide / 6.2, (g.side_top || 8) / 2.6, 4);
        const pu = Math.max(0.55, (g.side_top || 8) / mPerTile / 2);
        const pb = Math.max(0.22, (g.side_bot || 4) / mPerTile / 2);
        const cu = Math.max(pu + 0.4, catchSide / mPerTile / 2);
        const zPx = Math.max(10, Math.min(28, 14 * (22 / mPerTile))) * isoS;
        const digH = g.depth_m * zPx;
        const pondU = -3.1;
        const pondV = -0.2;

        isoSlab(-cu + pondU, cu + pondU, -cu + pondV, cu + pondV, P.lawn, 8);

        isoSlab(-0.45, 6.4, -0.38, 0.38, P.path, 6);

        isoSlab(2.4, 6.2, 2.8, 6.2, P.drip, 8);
        isoSlab(2.6, 6.4, -6.0, -3.2, P.frost, 8);

        function pondCell(u, v) { return [pondU + u, pondV + v]; }
        const top = [pondCell(-pu, -pu), pondCell(pu, -pu), pondCell(pu, pu), pondCell(-pu, pu)];
        const bot = [pondCell(-pb, -pb), pondCell(pb, -pb), pondCell(pb, pb), pondCell(-pb, pb)];
        function pt(c, drop) { return [gx(c[0], c[1]), gy(c[0], c[1]) + drop]; }

        const T = top.map(function (c) { return pt(c, 0); });
        const B = bot.map(function (c) { return pt(c, digH); });
        ctx.beginPath();
        ctx.moveTo(T[3][0], T[3][1]);
        ctx.lineTo(T[2][0], T[2][1]);
        ctx.lineTo(B[2][0], B[2][1]);
        ctx.lineTo(B[3][0], B[3][1]);
        ctx.closePath();
        ctx.fillStyle = P.soil.l;
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(T[2][0], T[2][1]);
        ctx.lineTo(T[1][0], T[1][1]);
        ctx.lineTo(B[1][0], B[1][1]);
        ctx.lineTo(B[2][0], B[2][1]);
        ctx.closePath();
        ctx.fillStyle = P.soil.r;
        ctx.fill();

        const waterDrop = digH * (1 - fill * 0.88);
        const wu = pb + (pu - pb) * fill;
        const W = [
          pondCell(-wu, -wu), pondCell(wu, -wu), pondCell(wu, wu), pondCell(-wu, wu)
        ].map(function (c) { return pt(c, waterDrop); });
        ctx.beginPath();
        ctx.moveTo(W[0][0], W[0][1]);
        ctx.lineTo(W[1][0], W[1][1]);
        ctx.lineTo(W[2][0], W[2][1]);
        ctx.lineTo(W[3][0], W[3][1]);
        ctx.closePath();
        const wg = ctx.createLinearGradient(W[0][0], W[0][1], W[2][0], W[2][1] + 20);
        wg.addColorStop(0, P.poolT);
        wg.addColorStop(1, P.poolB);
        ctx.fillStyle = wg;
        ctx.globalAlpha = 0.92;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.moveTo(T[0][0], T[0][1]);
        ctx.lineTo(T[1][0], T[1][1]);
        ctx.lineTo(T[2][0], T[2][1]);
        ctx.lineTo(T[3][0], T[3][1]);
        ctx.closePath();
        ctx.strokeStyle = P.edge;
        ctx.lineWidth = 1.2;
        ctx.stroke();

        const pump = [-0.6, 1.35];
        isoBox(gx(pump[0], pump[1]), gy(pump[0], pump[1]), 18, 9, 16, P.steel, true);
        isoBox(gx(pump[0], pump[1]) - 2, gy(pump[0], pump[1]) - 16, 10, 5, 6, P.tank);

        pipe([[pondU + pu * 0.2, pondV + pu], [-0.6, 1.0], pump], live, 7);
        pipe([pump, [1.2, 1.35], [1.2, 3.8], [2.6, 3.8]], live, 6);
        pipe([[1.2, 3.8], [1.2, 5.2], [2.6, 5.2]], live, 4);
        pipe([[1.2, 1.35], [1.2, -4.4], [2.8, -4.4]], false, 5);

        isoBox(gx(2.6, 3.8), gy(2.6, 3.8), 14, 7, 5, P.steel, true);

        for (let i = 0; i < 8; i++) {
          const u = 3.1 + (i % 4) * 0.7;
          const v = 4.05 + Math.floor(i / 4) * 1.15;
          isoBox(gx(u, v), gy(u, v), 3.2, 1.6, live ? 5 : 3, P.steel);
          if (live) {
            ctx.strokeStyle = "rgba(78,195,224,0.55)";
            ctx.beginPath();
            ctx.moveTo(gx(u, v), gy(u, v) - 5 * isoS);
            ctx.lineTo(gx(u, v) + 1 * isoS, gy(u, v) - 14 * isoS);
            ctx.stroke();
          }
        }

        [
          [-6.4, -6.2, 0.62], [6.4, -6.0, 0.7], [6.6, 6.2, 0.58], [-6.6, 6.0, 0.66],
          [-6.8, 2.2, 0.5], [6.5, 1.2, 0.48], [-4.8, -6.5, 0.44]
        ].forEach(function (t) {
          isoTree(gx(t[0], t[1]), gy(t[0], t[1]), t[2]);
        });

        const rim = pt(pondCell(pu, pu), 0);
        isoPerson(rim[0] + 10, rim[1] + 6, zPx);

        ctx.globalAlpha = 0.4;
        ctx.strokeStyle = P.poolT;
        ctx.lineWidth = 1;
        for (let i = 0; i < rain.length; i++) {
          const drop = rain[i];
          ctx.beginPath();
          ctx.moveTo(drop.x, drop.y);
          ctx.lineTo(drop.x + 1.1, drop.y + drop.len);
          ctx.stroke();
          drop.y += drop.v;
          drop.x += 0.25;
          if (drop.y > h) { drop.y = -8; drop.x = Math.random() * w; }
        }
        ctx.globalAlpha = 1;

        const narrow = w < 480;
        const pondLabel = g.side_top
          ? (narrow
            ? Math.round(g.usable_m3) + " m³"
            : g.side_top.toFixed(0) + " × " + g.side_top.toFixed(0) + " m · " + Math.round(g.usable_m3) + " m³")
          : (narrow ? "draw pond" : "Draw pond on Land");
        callout(gx(pondU, pondV - pu), gy(pondU, pondV - pu) - 8, pondLabel, false);
        callout(gx(pump[0], pump[1]) - 8, gy(pump[0], pump[1]) - 22, (pack && pack.params ? pack.params.main_flow_m3h : 8) + " m³/h", live);
        callout(gx(4.2, 4.6), gy(4.2, 4.6), live ? ("drip " + flow.toFixed(1)) : "drip", live);
        callout(gx(4.4, -4.6), gy(4.4, -4.6), "frost", false);

        ctx.fillStyle = P.ink;
        ctx.font = "600 12px IBM Plex Sans, ui-sans-serif, sans-serif";
        const clock = (function () {
          const n = ((tMin % 1440) + 1440) % 1440;
          const hh = Math.floor(n / 60);
          const mm = Math.floor(n % 60);
          return String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0");
        })();
        ctx.fillText(clock, 12, 20);
        ctx.font = "12px IBM Plex Sans, ui-sans-serif, sans-serif";
        ctx.fillStyle = P.mute;
        const caption = example ? (narrow ? "example basin" : "example basin — draw on Land to size this holding") : (pond && pond.name ? pond.name : "pond");
        ctx.fillText(caption, 12, 36);
        if (!narrow) ctx.fillText("1 tile ≈ " + mPerTile.toFixed(0) + " m   ·   person 1.8 m", 12, h - 12);
        if (g.too_steep) {
          ctx.fillStyle = "#c43c2c";
          ctx.fillText("Banks too steep for this area — flatten slope or enlarge the pond.", 16, 58);
        }

        ctx.strokeStyle = P.ink;
        ctx.lineWidth = 2;
        const barLen = 10 / mPerTile * TILE_W;
        const barX = Math.max(12, w - barLen - 36);
        const barY = h - 22;
        ctx.beginPath();
        ctx.moveTo(barX, barY);
        ctx.lineTo(barX + barLen, barY);
        ctx.stroke();
        ctx.font = "11px IBM Plex Sans, ui-sans-serif, sans-serif";
        ctx.fillStyle = P.ink;
        ctx.fillText("10 m", barX, barY - 6);

        requestAnimationFrame(draw);
      }

      function setTxt(id, v) {
        const el = document.getElementById(id);
        if (el) el.textContent = v;
      }

      function refreshFacts() {
        const d = design();
        const g = d.geom;
        const waterM = Math.max(0, g.depth_m - FREEBOARD);
        setTxt("pond-depth-val", d.depth.toFixed(1) + " m");
        setTxt("pond-slope-val", "1 : " + d.slope.toFixed(1));
        setTxt("pond-catch-val", d.catchF.toFixed(1) + "×");
        setTxt("pf-top", g.side_top ? g.side_top.toFixed(1) + " × " + g.side_top.toFixed(1) + " m" : "—");
        setTxt("pf-bot", g.side_bot ? g.side_bot.toFixed(1) + " × " + g.side_bot.toFixed(1) + " m" : "—");
        setTxt("pf-dig", g.depth_m.toFixed(1) + " m dig · " + waterM.toFixed(1) + " m water");
        setTxt("pf-bank", d.slope.toFixed(1) + " m out / 1 m down");
        const tankers = g.usable_m3 > 0 ? Math.max(1, Math.round(g.usable_m3 / 15)) : 0;
        setTxt("pf-vol", g.usable_m3 ? Math.round(g.usable_m3) + " m³ · " + tankers + " × 15 m³" : "—");
        const catchHa = (d.area * d.catchF) / 10000;
        setTxt("pf-catch", d.catchF.toFixed(1) + "× · " + catchHa.toFixed(2) + " ha field");
        setTxt("pf-ha", d.ha ? d.ha.toFixed(3) + " ha drawn" : "not drawn");
        if (budget && !example) {
          const store = g.usable_m3;
          const rainNet = d.yld.net_m3;
          const need = budget.storage_need_m3 || 0;
          setTxt("wb-store", Math.round(store) + " m3");
          setTxt("wb-rain", Math.round(rainNet) + " m3");
          const gap = round1(need - store);
          setTxt("wb-gap", (gap > 0 ? "+" : "") + Math.round(gap) + " m3");
          const pip = document.getElementById("wb-ok");
          if (pip) {
            pip.textContent = gap <= 0 ? "OK" : "SHORT";
            pip.className = "pond-ok " + (gap <= 0 ? "ok" : "warn");
          }
        }
      }

      function applyBudget(data) {
        budget = data;
        pond = (data.ponds && data.ponds[0]) || null;
        example = !pond;
        const empty = document.getElementById("pond-empty");
        const tools = document.getElementById("pond-tools");
        const facts = document.getElementById("pond-facts");
        if (empty) empty.hidden = !!pond;
        if (tools) tools.hidden = false;
        if (facts) facts.hidden = false;
        const admin = document.body.classList.contains("is-admin");
        [depthEl, slopeEl, catchEl].forEach(function (el) {
          if (el) el.disabled = !admin;
        });
        if (saveBtn) saveBtn.hidden = !admin || !pond;
        if (pond) {
          if (depthEl) depthEl.value = String(pond.depth_m);
          if (slopeEl) slopeEl.value = String(pond.bank_slope);
          if (catchEl) catchEl.value = String(pond.catchment_factor);
        }
        setTxt("wb-demand", Math.round(data.demand_year_m3) + " m3");
        setTxt("wb-need", Math.round(data.storage_need_m3) + " m3");
        setTxt("wb-store", Math.round(data.storage_usable_m3) + " m3");
        setTxt("wb-rain", Math.round(data.rain_net_m3) + " m3");
        const gap = data.gap_m3;
        setTxt("wb-gap", (gap > 0 ? "+" : "") + Math.round(gap) + " m3");
        const pip = document.getElementById("wb-ok");
        if (pip) {
          pip.textContent = data.ok ? "OK" : "SHORT";
          pip.className = "pond-ok " + (data.ok ? "ok" : "warn");
        }
        const list = document.getElementById("wb-plots");
        if (list) {
          list.innerHTML = (data.plots || []).filter(function (p) { return p.total_m3 > 0; }).map(function (p) {
            return "<li class='row'><span>" + String(p.name).replace(/[<>]/g, "") +
              "</span><span class='meta'>" + Math.round(p.total_m3) + " m3</span></li>";
          }).join("") || "<li class='dim' data-i18n='water_pond_no_demand'>No irrigated area yet — draw fields on Land.</li>";
        }
        refreshFacts();
      }

      async function loadBudget() {
        const res = await fetch("/v1/water/budget?farm=" + encodeURIComponent(FARM));
        if (!res.ok) return;
        applyBudget(await res.json());
      }

      async function savePond() {
        if (!pond || !document.body.classList.contains("is-admin")) return;
        const body = {
          depth_m: num(depthEl, 2.2),
          bank_slope: num(slopeEl, 2.5),
          catchment_factor: num(catchEl, 4)
        };
        const res = await fetch("/v1/water/ponds/" + pond.plot_id, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
        const data = await res.json().catch(function () { return {}; });
        if (!res.ok) return;
        pond.depth_m = data.depth_m;
        pond.bank_slope = data.bank_slope;
        pond.catchment_factor = data.catchment_factor;
        pond.geom = data.geom;
        pond.yield = data.yield;
        loadBudget();
      }

      function onSlide() {
        refreshFacts();
        if (!pond) return;
        pond.depth_m = num(depthEl, pond.depth_m);
        pond.bank_slope = num(slopeEl, pond.bank_slope);
        pond.catchment_factor = num(catchEl, pond.catchment_factor);
        clearTimeout(saveTimer);
        saveTimer = setTimeout(savePond, 700);
      }

      [depthEl, slopeEl, catchEl].forEach(function (el) {
        if (el) el.addEventListener("input", onSlide);
      });
      if (saveBtn) saveBtn.addEventListener("click", savePond);

      window.PoljeIso = {
        setClock: function (t, p) {
          tMin = t;
          if (p) pack = p;
        }
      };

      resize();
      spawnRain(28);
      window.addEventListener("resize", function () { resize(); spawnRain(28); });
      if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", function () { resize(); });
      }
      requestAnimationFrame(draw);
      loadBudget();
    })();
`.trim();
