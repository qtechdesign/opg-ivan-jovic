/** Dewline pack play/scrub on /water. No React. */

export const DEWLINE_SIM_JS = `
    (function () {
      const canvas = document.getElementById("pack-canvas");
      if (!canvas || !canvas.getContext) return;
      const ctx = canvas.getContext("2d");
      const playBtn = document.getElementById("pack-play");
      const resetBtn = document.getElementById("pack-reset");
      const scrub = document.getElementById("pack-scrub");
      const clockEl = document.getElementById("pack-clock");
      const slotsEl = document.getElementById("pack-slots");
      const saveBtn = document.getElementById("pack-save");
      let pack = null;
      let tMin = 5 * 60;
      let playing = false;
      let last = 0;

      function num(el, fallback) {
        if (!el) return fallback;
        const n = Number(el.value);
        return Number.isFinite(n) ? n : fallback;
      }

      function formatMin(m) {
        const h = Math.floor(((m % 1440) + 1440) % 1440 / 60);
        const min = Math.floor(((m % 1440) + 1440) % 1440 % 60);
        return String(h).padStart(2, "0") + ":" + String(min).padStart(2, "0");
      }

      function sampleAt(t) {
        const series = (pack && pack.tank_series) || [];
        if (!series.length) return { fill_pct: 0, flow_m3h: 0, starved: false, level_m3: 0 };
        let best = series[0];
        for (let i = 0; i < series.length; i++) {
          if (series[i].t_min <= t) best = series[i];
          else break;
        }
        return best;
      }

      function activeSlots(t) {
        if (!pack) return [];
        return (pack.slots || []).filter(function (s) {
          return !s.skipped && s.startMin <= t && t < s.endMin;
        });
      }

      function resize() {
        const w = canvas.clientWidth || 640;
        const h = canvas.clientHeight || 220;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      function draw() {
        const w = canvas.clientWidth || 640;
        const h = canvas.clientHeight || 220;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = "#0a1822";
        ctx.fillRect(0, 0, w, h);

        const cap = pack && pack.params ? pack.params.main_flow_m3h : 8;
        const sample = sampleAt(tMin);
        const active = activeSlots(tMin);
        const peak = pack ? pack.peak_flow_m3h : 0;

        const pad = 16;
        const ganttTop = 18;
        const ganttH = h * 0.42;
        const barY = ganttTop + ganttH + 18;
        const pondX = w < 400 ? w - 56 : w - 88;
        const day = 24 * 60;

        const live = pack ? (pack.slots || []).filter(function (s) { return !s.skipped && s.endMin > s.startMin; }) : [];
        live.forEach(function (s, i) {
          const y = ganttTop + (live.length ? (i / live.length) * ganttH : 0);
          const rowH = Math.max(8, ganttH / Math.max(live.length, 1) - 3);
          const x = pad + (s.startMin / day) * (pondX - pad - 24);
          const bw = Math.max(2, ((s.endMin - s.startMin) / day) * (pondX - pad - 24));
          const on = s.startMin <= tMin && tMin < s.endMin;
          ctx.fillStyle = on ? "#5ee0a0" : "rgba(94,224,160,0.28)";
          ctx.fillRect(x, y, bw, rowH);
        });

        const playX = pad + (tMin / day) * (pondX - pad - 24);
        ctx.strokeStyle = "#f0c75e";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(playX, ganttTop - 4);
        ctx.lineTo(playX, ganttTop + ganttH + 4);
        ctx.stroke();

        const used = sample.flow_m3h || 0;
        const barW = pondX - pad - 24;
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.fillRect(pad, barY, barW, 10);
        ctx.fillStyle = used > cap + 0.01 ? "#e85d4c" : "#4aa3d8";
        ctx.fillRect(pad, barY, barW * Math.min(1, used / Math.max(cap, 0.1)), 10);
        ctx.fillStyle = "rgba(240,199,94,0.7)";
        ctx.fillRect(pad + barW * Math.min(1, cap / Math.max(cap, peak, 0.1)) - 1, barY - 2, 2, 14);

        ctx.fillStyle = "#8aa0b0";
        ctx.font = "11px ui-sans-serif, system-ui, sans-serif";
        ctx.fillText(used.toFixed(1) + " / " + cap.toFixed(1) + " m3/h", pad, barY + 24);

        const pondY = 28;
        const pondW = 64;
        const pondH = h - 56;
        ctx.strokeStyle = "rgba(255,255,255,0.25)";
        ctx.strokeRect(pondX, pondY, pondW, pondH);
        const fillH = pondH * Math.max(0, Math.min(1, (sample.fill_pct || 0) / 100));
        ctx.fillStyle = sample.starved ? "rgba(232,93,76,0.55)" : "rgba(74,163,216,0.55)";
        ctx.fillRect(pondX, pondY + pondH - fillH, pondW, fillH);
        ctx.fillStyle = "#cfe6f2";
        ctx.font = "10px ui-sans-serif, system-ui, sans-serif";
        ctx.fillText(Math.round(sample.fill_pct || 0) + "%", pondX + 18, pondY + pondH + 14);

        active.forEach(function (s, i) {
          const sx = 28 + (i % 4) * 22;
          const sy = h - 28;
          ctx.fillStyle = "#5ee0a0";
          ctx.beginPath();
          ctx.arc(sx, sy, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "rgba(94,224,160,0.45)";
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + 2, sy - 10 - (i % 3) * 4);
          ctx.stroke();
        });
      }

      function setClock() {
        if (clockEl) clockEl.textContent = formatMin(tMin);
        if (scrub) scrub.value = String(tMin);
        const sample = sampleAt(tMin);
        const active = activeSlots(tMin);
        if (slotsEl && pack) {
          const live = (pack.slots || []).filter(function (s) { return !s.skipped; });
          slotsEl.innerHTML = live.map(function (s) {
            const on = s.startMin <= tMin && tMin < s.endMin;
            return "<li class='row" + (on ? " is-on" : "") + "'><span>" +
              String(s.zone).replace(/[<>]/g, "") +
              "</span><span class='meta'>" + formatMin(s.startMin) + "–" + formatMin(s.endMin) +
              " · " + Number(s.volumeM3).toFixed(2) + " m3" + (on ? " ●" : "") + "</span></li>";
          }).join("") || "<li class='dim' data-i18n='water_pack_empty'>No drip zones to pack.</li>";
        }
        const starved = document.getElementById("pack-starved");
        if (starved) starved.hidden = !sample.starved;
        if (window.PoljeIso && window.PoljeIso.setClock) window.PoljeIso.setClock(tMin, pack);
        draw();
      }

      function applyPack(data) {
        pack = data;
        const set = function (id, v) {
          const el = document.getElementById(id);
          if (el) el.textContent = v;
        };
        set("pack-peak", (data.peak_flow_m3h != null ? data.peak_flow_m3h : "—") + " m3/h");
        set("pack-day", (data.total_m3_day != null ? data.total_m3_day : "—") + " m3");
        const pump = data.params && data.params.main_flow_m3h != null ? data.params.main_flow_m3h : "—";
        set("pack-pump", pump + " m3/h");
        const saved = data.savings && data.savings.saved_cents != null
          ? (data.savings.saved_cents / 100).toFixed(0) + " EUR"
          : "—";
        set("pack-saved", saved);
        const main = document.getElementById("pack-main");
        const cycles = document.getElementById("pack-cycles");
        const well = document.getElementById("pack-well");
        const price = document.getElementById("pack-price");
        if (data.params) {
          if (main) main.value = data.params.main_flow_m3h;
          if (cycles) cycles.value = data.params.cycles_per_day;
          if (well) well.value = data.params.well_rate_m3h;
          if (price) price.value = data.params.water_price_cents;
        }
        setClock();
      }

      async function loadPack() {
        const res = await fetch("/v1/water/pack?farm=" + encodeURIComponent(FARM));
        if (!res.ok) return;
        applyPack(await res.json());
      }

      async function savePump() {
        if (!document.body.classList.contains("is-admin")) return;
        const body = {
          main_flow_m3h: num(document.getElementById("pack-main"), 8),
          cycles_per_day: Math.round(num(document.getElementById("pack-cycles"), 1)),
          well_rate_m3h: num(document.getElementById("pack-well"), 0),
          water_price_cents: Math.round(num(document.getElementById("pack-price"), 240))
        };
        const res = await fetch("/v1/water/pump?farm=" + encodeURIComponent(FARM), {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
        if (!res.ok) return;
        loadPack();
      }

      if (playBtn) playBtn.addEventListener("click", function () {
        playing = !playing;
        playBtn.textContent = playing ? t("water_pack_pause") : t("water_pack_play");
      });
      if (resetBtn) resetBtn.addEventListener("click", function () {
        playing = false;
        tMin = 5 * 60;
        if (playBtn) playBtn.textContent = t("water_pack_play");
        setClock();
      });
      if (scrub) scrub.addEventListener("input", function () {
        playing = false;
        tMin = Number(scrub.value) || 0;
        if (playBtn) playBtn.textContent = t("water_pack_play");
        setClock();
      });
      if (saveBtn) saveBtn.addEventListener("click", savePump);

      function tick(ts) {
        if (playing) {
          if (!last) last = ts;
          const dt = ts - last;
          if (dt > 40) {
            tMin += 2;
            if (tMin >= 23 * 60) {
              tMin = 23 * 60;
              playing = false;
              if (playBtn) playBtn.textContent = t("water_pack_play");
            }
            last = ts;
            setClock();
          }
        } else {
          last = 0;
        }
        requestAnimationFrame(tick);
      }

      resize();
      window.addEventListener("resize", function () { resize(); draw(); });
      if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", function () { resize(); draw(); });
      }
      requestAnimationFrame(tick);
      loadPack();
    })();
`.trim();
