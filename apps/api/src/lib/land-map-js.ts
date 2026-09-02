/** Field map: many OPG locations, fields inside them, move + corner edit. */
import { PLOT_USES } from "./plot-uses";

export const LAND_MAP_JS = `
    (function () {
      const PLOT_USES = ${JSON.stringify(PLOT_USES)};
      const host = document.getElementById("farm-map");
      if (!host) return;
      const key = (host.getAttribute("data-maps-key") || "").trim();
      const latAttr = host.getAttribute("data-lat");
      const lonAttr = host.getAttribute("data-lon");
      const farmLat = latAttr ? Number(latAttr) : null;
      const farmLon = lonAttr ? Number(lonAttr) : null;
      const farmName = (host.getAttribute("data-farm-name") || "").trim();

      let holdings = [];
      let drawKind = null;
      let clipHolding = null;
      let moveMode = false;

      function setMsg(text, err) {
        const el = document.getElementById("map-msg");
        if (!el) return;
        el.textContent = text || "";
        el.hidden = !text;
        el.className = "map-toast msg" + (err ? " err" : "");
      }

      if (!key) {
        setMsg(t("land_map_need_key"), true);
        return;
      }

      function esc(s) {
        return String(s).replace(/[&<>"]/g, function (c) {
          return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c];
        });
      }
      function isAdmin() { return document.body.classList.contains("is-admin"); }
      function colorFor(use) {
        const hit = PLOT_USES.find(function (u) { return u.id === use; });
        return hit ? hit.color : "#6b4a2e";
      }
      function useLabel(use) {
        if (!use) return "—";
        const k = "plot_use_" + use;
        const s = t(k);
        return s === k ? use : s;
      }
      function drawnHa(p) {
        return p && p.geom_json && p.hectares != null ? p.hectares : null;
      }
      function ringToPath(ring) {
        return ring.map(function (p) { return { lat: p[1], lng: p[0] }; });
      }
      function pathToGeo(poly) {
        const path = poly.getPath();
        const ring = [];
        for (let i = 0; i < path.getLength(); i++) {
          const p = path.getAt(i);
          ring.push([p.lng(), p.lat()]);
        }
        if (ring.length && (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])) {
          ring.push([ring[0][0], ring[0][1]]);
        }
        return { type: "Polygon", coordinates: [ring] };
      }
      function haOf(poly) {
        if (!google.maps.geometry || !google.maps.geometry.spherical) return null;
        const m2 = google.maps.geometry.spherical.computeArea(poly.getPath());
        return Math.round((m2 / 10000) * 10000) / 10000;
      }
      function openRing(ring) {
        if (!ring || !ring.length) return [];
        const a = ring[0], b = ring[ring.length - 1];
        if (a && b && a[0] === b[0] && a[1] === b[1]) return ring.slice(0, -1);
        return ring.slice();
      }
      function pointOnSeg(a, b, lng, lat, eps) {
        const minX = Math.min(a[0], b[0]) - eps, maxX = Math.max(a[0], b[0]) + eps;
        const minY = Math.min(a[1], b[1]) - eps, maxY = Math.max(a[1], b[1]) + eps;
        if (lng < minX || lng > maxX || lat < minY || lat > maxY) return false;
        const cross = (lng - a[0]) * (b[1] - a[1]) - (lat - a[1]) * (b[0] - a[0]);
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        return Math.abs(cross) / len <= eps;
      }
      function pointInRing(ring, lng, lat) {
        const pts = openRing(ring);
        if (pts.length < 3) return false;
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i], b = pts[(i + 1) % pts.length];
          if (pointOnSeg(a, b, lng, lat, 1.5e-6)) return true;
        }
        let inside = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const yi = pts[i][1], yj = pts[j][1], xi = pts[i][0], xj = pts[j][0];
          const hit = (yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / ((yj - yi) || 1e-18) + xi;
          if (hit) inside = !inside;
        }
        return inside;
      }
      function nearestOnRing(ring, lng, lat) {
        const pts = openRing(ring);
        if (!pts.length) return [lng, lat];
        let best = pts[0], bestD = Infinity;
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i], b = pts[(i + 1) % pts.length];
          const dx = b[0] - a[0], dy = b[1] - a[1];
          const len2 = dx * dx + dy * dy || 1;
          let u = ((lng - a[0]) * dx + (lat - a[1]) * dy) / len2;
          if (u < 0) u = 0; else if (u > 1) u = 1;
          const p = [a[0] + u * dx, a[1] + u * dy];
          const d = (p[0] - lng) * (p[0] - lng) + (p[1] - lat) * (p[1] - lat);
          if (d < bestD) { bestD = d; best = p; }
        }
        return best;
      }
      function holdingById(id) {
        return holdings.find(function (h) { return h.id === id; }) || null;
      }
      function ringOf(h) {
        if (!h || !h.geom_json) return null;
        try {
          const g = JSON.parse(h.geom_json);
          return g && g.coordinates && g.coordinates[0] ? g.coordinates[0] : null;
        } catch (e) { return null; }
      }
      function holdingAt(ll) {
        for (let i = 0; i < holdings.length; i++) {
          const ring = ringOf(holdings[i]);
          if (ring && pointInRing(ring, ll.lng(), ll.lat())) return holdings[i];
        }
        return null;
      }
      function activeClip() {
        if (drawKind === "holding") return null;
        if (clipHolding) return clipHolding;
        if (selectedHoldingId) return holdingById(selectedHoldingId);
        return null;
      }
      function clampToHolding(ll) {
        const h = activeClip();
        const ring = h ? ringOf(h) : null;
        if (!ring) {
          if (drawKind === "holding") return ll;
          if (!holdings.some(function (x) { return x.geom_json; })) return ll;
          const hit = holdingAt(ll);
          if (hit) { clipHolding = hit; return ll; }
          return null;
        }
        const lng = ll.lng(), lat = ll.lat();
        if (pointInRing(ring, lng, lat)) return ll;
        const snap = nearestOnRing(ring, lng, lat);
        const snapLl = new google.maps.LatLng(snap[1], snap[0]);
        const dist = google.maps.geometry && google.maps.geometry.spherical
          ? google.maps.geometry.spherical.computeDistanceBetween(ll, snapLl)
          : 999;
        if (dist <= 28) return snapLl;
        return null;
      }
      function centroidOf(path) {
        let lat = 0, lng = 0, n = 0;
        const last = path.length - 1;
        const closed = last > 0 && path[0].lat === path[last].lat && path[0].lng === path[last].lng;
        const end = closed ? last : path.length;
        for (let i = 0; i < end; i++) { lat += path[i].lat; lng += path[i].lng; n++; }
        if (!n) return path[0];
        return { lat: lat / n, lng: lng / n };
      }
      function viewKey() { return "polje_map_" + FARM; }
      function saveView(map) {
        try {
          const c = map.getCenter();
          if (!c) return;
          localStorage.setItem(viewKey(), JSON.stringify({ lat: c.lat(), lng: c.lng(), zoom: map.getZoom() }));
        } catch (e) {}
      }
      function readView() {
        try {
          const raw = localStorage.getItem(viewKey());
          return raw ? JSON.parse(raw) : null;
        } catch (e) { return null; }
      }
      function goToPlace(map, loc, viewport) {
        if (viewport) map.fitBounds(viewport);
        else { map.setCenter(loc); map.setZoom(17); }
        saveView(map);
      }

      const lang = (typeof LANG !== "undefined" && LANG === "hr") ? "hr" : "en";
      let booted = false;
      window.__poljeInitMap = function () {
        if (booted) return;
        booted = true;
        try { init(); }
        catch (err) { console.warn("maps init", err); setMsg(t("land_map_load_fail"), true); }
      };
      if (window.google && google.maps && google.maps.Map) window.__poljeInitMap();
      else {
        const s = document.createElement("script");
        s.src = "https://maps.googleapis.com/maps/api/js?key=" + encodeURIComponent(key) +
          "&callback=__poljeInitMap&libraries=places,geometry&v=weekly&language=" + lang + "&region=HR";
        s.async = true; s.defer = true;
        s.onerror = function () { setMsg(t("land_map_load_fail"), true); };
        document.head.appendChild(s);
      }

      function init() {
        const remembered = readView();
        const start = (farmLat != null && farmLon != null && !Number.isNaN(farmLat))
          ? { lat: farmLat, lng: farmLon, zoom: 16 }
          : (remembered && remembered.lat
            ? { lat: remembered.lat, lng: remembered.lng, zoom: remembered.zoom || 16 }
            : { lat: 45.71, lng: 16.39, zoom: 13 });

        const map = new google.maps.Map(host, {
          center: { lat: start.lat, lng: start.lng },
          zoom: start.zoom,
          mapTypeId: "hybrid",
          mapTypeControl: true,
          mapTypeControlOptions: {
            style: google.maps.MapTypeControlStyle.DROPDOWN_MENU,
            position: google.maps.ControlPosition.TOP_RIGHT,
            mapTypeIds: ["hybrid", "satellite", "roadmap"]
          },
          streetViewControl: true,
          streetViewControlOptions: { position: google.maps.ControlPosition.RIGHT_BOTTOM },
          fullscreenControl: true,
          fullscreenControlOptions: { position: google.maps.ControlPosition.RIGHT_TOP },
          zoomControl: true,
          zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_BOTTOM },
          gestureHandling: "greedy",
          clickableIcons: false,
          disableDoubleClickZoom: false
        });

        const overlays = [];
        const holdOverlays = [];
        const info = new google.maps.InfoWindow();
        let plots = [];
        let selectedId = null;
        let selectedHoldingId = null;
        let skipMapClick = false;
        let saveTimer = null;
        let ignorePath = 0;
        let pathEpoch = 0;
        const saveTok = {};
        const landOrigin = Math.random().toString(36).slice(2, 10);
        let drawing = false;
        let draftPts = [];
        let draftLine = null;
        let ghostLine = null;
        let draftDots = [];
        let pendingGeo = null;
        let pendingPreview = null;
        let pendingHolding = false;
        let pendingUse = null;
        let moveHandle = null;
        let moveStart = null;
        let pointerDown = null;
        let mapIdle = true;

        function setMapGrab(on) {
          map.setOptions({
            draggable: on,
            gestureHandling: on ? "greedy" : "none",
            disableDoubleClickZoom: !on
          });
        }
        function landHeaders() {
          return { "Content-Type": "application/json", "X-Polje-Land": landOrigin };
        }
        function bindPath(poly, later) {
          const path = poly.getPath();
          path.addListener("set_at", later);
          path.addListener("insert_at", later);
          path.addListener("remove_at", later);
        }
        function pathLater(run) {
          return function () {
            if (ignorePath || moveMode) return;
            const epoch = pathEpoch;
            clearTimeout(saveTimer);
            saveTimer = setTimeout(function () {
              if (epoch !== pathEpoch) return;
              run();
            }, 800);
          };
        }
        function setPolyRing(ov, ring) {
          if (!ov || !ov.poly || !ring) return;
          ignorePath++;
          ov.poly.setPath(ringToPath(ring));
          ignorePath--;
          if (ov.later) bindPath(ov.poly, ov.later);
        }
        function labelAtPoly(ov) {
          if (!ov || !ov.label || !ov.poly) return;
          const path = [];
          ov.poly.getPath().forEach(function (ll) { path.push({ lat: ll.lat(), lng: ll.lng() }); });
          if (path.length) ov.label.setPosition(centroidOf(path));
        }

        function showDraftBtns() {
          const undo = document.getElementById("map-undo");
          const cancel = document.getElementById("map-cancel");
          const done = document.getElementById("map-done");
          const pending = !!pendingGeo;
          if (undo) undo.hidden = !drawing;
          if (cancel) cancel.hidden = !(drawing || pending);
          if (done) {
            done.hidden = !drawing;
            done.disabled = draftPts.length < 3;
            done.classList.toggle("btn-primary", drawing && draftPts.length >= 3);
          }
        }

        function syncDrawBtn() {
          const holdBtn = document.getElementById("map-holding");
          const drawBtn = document.getElementById("map-draw");
          const moveBtn = document.getElementById("map-move");
          const editBtn = document.getElementById("map-edit");
          const saveBtn = document.getElementById("map-new-save");
          if (holdBtn) holdBtn.textContent = (drawing && drawKind === "holding") ? t("land_map_done") : t("land_map_holding");
          if (drawBtn) drawBtn.textContent = (drawing && drawKind === "plot") ? t("land_map_done") : t("land_map_draw");
          if (moveBtn) moveBtn.classList.toggle("is-on", moveMode);
          if (editBtn) editBtn.classList.toggle("is-on", !moveMode && !!(selectedId || selectedHoldingId) && !drawing);
          if (saveBtn && pendingGeo) saveBtn.textContent = pendingHolding ? t("land_map_holding_save") : t("land_save_plot");
          showDraftBtns();
        }

        function clearDraft() {
          draftPts = [];
          clipHolding = null;
          if (draftLine) { draftLine.setMap(null); draftLine = null; }
          if (ghostLine) { ghostLine.setMap(null); ghostLine = null; }
          draftDots.forEach(function (d) { d.setMap(null); });
          draftDots = [];
          drawing = false;
          drawKind = null;
          setMapGrab(true);
          syncDrawBtn();
        }

        function cancelPending() {
          pendingGeo = null;
          pendingHolding = false;
          pendingUse = null;
          if (pendingPreview) { pendingPreview.setMap(null); pendingPreview = null; }
          setNewBox(null);
          syncDrawBtn();
        }

        function undoDraft() {
          if (!drawing || !draftPts.length) return;
          const last = draftDots.pop();
          if (last) last.setMap(null);
          draftPts.pop();
          if (draftLine) draftLine.setPath(draftPts);
          if (!draftPts.length) {
            clipHolding = selectedHoldingId ? holdingById(selectedHoldingId) : null;
            if (draftLine) { draftLine.setMap(null); draftLine = null; }
          }
          showDraftBtns();
        }

        function setNewBox(mode) {
          const box = document.getElementById("map-new");
          const useEl = document.getElementById("map-new-use");
          const nameEl = document.getElementById("map-new-name");
          const saveBtn = document.getElementById("map-new-save");
          if (!box) return;
          box.hidden = !mode;
          if (useEl) {
            useEl.hidden = mode === "holding";
            if (mode === "plot" && pendingUse) useEl.value = pendingUse;
          }
          if (saveBtn) saveBtn.textContent = mode === "holding" ? t("land_map_holding_save") : t("land_save_plot");
          if (nameEl && mode === "holding") {
            if (!nameEl.value) nameEl.placeholder = t("land_map_holding_name");
          }
          showDraftBtns();
        }

        function finishDraft() {
          if (draftPts.length < 3) return setMsg(t("land_map_need_shape"), true);
          const isHold = drawKind === "holding";
          const poly = new google.maps.Polygon({
            paths: draftPts.slice(),
            strokeColor: isHold ? "#f4f1e8" : "#005288",
            fillColor: isHold ? "#f4f1e8" : "#005288",
            strokeWeight: isHold ? 3 : 2,
            fillOpacity: isHold ? 0.06 : 0.28,
            map: map,
            editable: true,
            clickable: true
          });
          const geo = pathToGeo(poly);
          const holdForPlot = clipHolding;
          clearDraft();
          if (isHold) {
            pendingGeo = geo;
            pendingHolding = true;
            if (pendingPreview) pendingPreview.setMap(null);
            pendingPreview = poly;
            setNewBox("holding");
            const nameEl = document.getElementById("map-new-name");
            if (nameEl) nameEl.focus();
            setMsg(t("land_map_holding_name"));
            return;
          }
          pendingGeo = geo;
          pendingHolding = false;
          clipHolding = holdForPlot;
          if (pendingPreview) pendingPreview.setMap(null);
          pendingPreview = poly;
          if (!selectedId) {
            setNewBox("plot");
            const nameEl = document.getElementById("map-new-name");
            if (nameEl) nameEl.focus();
            setMsg(t("land_map_name_new"));
            return;
          }
          poly.setMap(null);
          pendingGeo = null;
          savePoly(poly, selectedId, holdForPlot && holdForPlot.id);
        }

        function addDraftPt(ll) {
          const clamped = clampToHolding(ll);
          if (!clamped) return setMsg(t("land_map_outside"), true);
          ll = clamped;
          if (!clipHolding && drawKind === "plot") clipHolding = holdingAt(ll) || activeClip();
          if (draftPts.length >= 3) {
            const first = draftPts[0];
            const d = google.maps.geometry && google.maps.geometry.spherical
              ? google.maps.geometry.spherical.computeDistanceBetween(ll, first)
              : 999;
            if (d < 14) return finishDraft();
          }
          draftPts.push(ll);
          if (!draftLine) {
            draftLine = new google.maps.Polyline({
              path: draftPts,
              strokeColor: drawKind === "holding" ? "#f4f1e8" : "#005288",
              strokeWeight: 2.5,
              geodesic: true,
              map: map,
              clickable: false
            });
          } else draftLine.setPath(draftPts);
          const isFirst = draftPts.length === 1;
          const dot = new google.maps.Marker({
            position: ll,
            map: map,
            clickable: isFirst,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: isFirst ? 9 : 5,
              fillColor: "#fff",
              fillOpacity: 1,
              strokeColor: drawKind === "holding" ? "#101218" : "#005288",
              strokeWeight: 2
            },
            zIndex: 20
          });
          if (isFirst) {
            dot.addListener("click", function () { if (draftPts.length >= 3) finishDraft(); });
          }
          draftDots.push(dot);
          showDraftBtns();
        }

        function startDraw(kind) {
          if (!isAdmin()) return setMsg(t("op_off"), true);
          if (drawing) {
            if (draftPts.length >= 3) finishDraft();
            else { clearDraft(); setMsg(""); }
            return;
          }
          const want = kind === "holding" ? "holding" : "plot";
          const anyHold = holdings.some(function (h) { return h.geom_json; });
          if (want === "plot" && !anyHold) return setMsg(t("land_map_need_holding"), true);
          cancelPending();
          moveMode = false;
          drawing = true;
          drawKind = want;
          clipHolding = want === "plot" ? (selectedHoldingId ? holdingById(selectedHoldingId) : null) : null;
          if (want === "holding") selectedId = null;
          setMapGrab(false);
          setMsg(want === "holding" ? t("land_map_holding_drawing") : (selectedId ? t("land_map_drawing") : t("land_map_drawing_new")));
          syncDrawBtn();
        }

        function markList() {
          document.querySelectorAll("[data-plot-id]").forEach(function (el) {
            el.classList.toggle("is-on", el.getAttribute("data-plot-id") === selectedId);
          });
        }

        function fillBook() {
          const body = document.getElementById("land-book-body");
          if (!body) return;
          const rows = [];
          const byHold = {};
          holdings.forEach(function (h) { byHold[h.id] = []; });
          const loose = [];
          function locName(p) {
            if (p.holding_id) {
              const h = holdingById(p.holding_id);
              if (h) return h.name;
            }
            if (p.geom_json) {
              try {
                const g = JSON.parse(p.geom_json);
                const ring = g.coordinates && g.coordinates[0];
                if (ring) {
                  const c = centroidOf(ringToPath(ring));
                  const hit = holdingAt({ lng: function () { return c.lng; }, lat: function () { return c.lat; } });
                  if (hit) return hit.name;
                }
              } catch (e) {}
            }
            return "—";
          }
          plots.forEach(function (p) {
            const ha = drawnHa(p);
            const rec = { plot: p, ha: ha };
            let locId = p.holding_id;
            if (!locId && p.geom_json) {
              try {
                const g = JSON.parse(p.geom_json);
                const ring = g.coordinates && g.coordinates[0];
                if (ring) {
                  const c = centroidOf(ringToPath(ring));
                  const hit = holdingAt({ lng: function () { return c.lng; }, lat: function () { return c.lat; } });
                  if (hit) locId = hit.id;
                }
              } catch (e) {}
            }
            if (locId && byHold[locId]) byHold[locId].push(rec);
            else loose.push(rec);
          });
          function addRow(loc, rec) {
            const p = rec.plot;
            const locLabel = loc === "—" ? locName(p) : loc;
            rows.push("<tr data-plot-id='" + esc(p.id) + "' class='land-book-row" + (p.id === selectedId ? " is-on" : "") + "'>" +
              "<td>" + esc(locLabel) + "</td>" +
              "<td>" + esc(p.name) + "</td>" +
              "<td>" + esc(useLabel(p.use_type)) + "</td>" +
              "<td>" + (rec.ha != null ? rec.ha + " ha" : "—") + "</td></tr>");
          }
          holdings.forEach(function (h) {
            const list = byHold[h.id] || [];
            if (!list.length && h.geom_json) {
              rows.push("<tr class='land-book-hold'><td>" + esc(h.name) + "</td><td colspan='3' class='dim'>" +
                esc(t("land_map_holding_kind")) + (h.hectares != null ? " · " + h.hectares + " ha" : "") + "</td></tr>");
            }
            list.forEach(function (rec) { addRow(h.name, rec); });
          });
          loose.forEach(function (rec) { addRow("—", rec); });
          body.innerHTML = rows.length ? rows.join("") : "<tr><td colspan='4' class='dim'>" + esc(t("land_no_plots")) + "</td></tr>";
          body.querySelectorAll("[data-plot-id]").forEach(function (tr) {
            tr.addEventListener("click", function () {
              const id = tr.getAttribute("data-plot-id");
              const btn = document.querySelector("#map-chips [data-chip-plot='" + id + "']");
              if (btn) btn.click();
            });
          });
        }

        function fillTotal() {
          const el = document.getElementById("map-total");
          if (!el) return;
          let sum = 0, n = 0;
          plots.forEach(function (p) {
            const ha = drawnHa(p);
            if (ha != null) { sum += Number(ha); n++; }
          });
          sum = Math.round(sum * 10000) / 10000;
          const locN = holdings.filter(function (h) { return h.geom_json; }).length;
          el.textContent = t("land_map_book_total", { loc: locN, ha: sum, n: n, all: plots.length });
        }

        function fillChips() {
          const box = document.getElementById("map-chips");
          if (!box) return;
          box.innerHTML = "";
          holdings.forEach(function (h) {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "map-chip map-chip-hold" + (h.id === selectedHoldingId ? " is-on" : "") + (h.geom_json ? "" : " is-empty");
            btn.textContent = h.name + (h.hectares != null ? " · " + h.hectares + " ha" : "");
            btn.onclick = function () {
              selectedHoldingId = h.id;
              selectedId = null;
              moveMode = false;
              fillChips();
              const ov = holdOverlays.find(function (o) { return o.holding.id === h.id; });
              if (ov) {
                const b = new google.maps.LatLngBounds();
                ov.poly.getPath().forEach(function (ll) { b.extend(ll); });
                map.fitBounds(b, 56);
                setEditable(null, h.id);
                if (isAdmin()) setMsg(t("land_map_editing"));
              }
            };
            box.appendChild(btn);
          });
          if (isAdmin()) {
            const plusH = document.createElement("button");
            plusH.type = "button";
            plusH.className = "map-chip map-chip-hold map-chip-new";
            plusH.textContent = "+ " + t("land_map_holding");
            plusH.onclick = function () { startDraw("holding"); };
            box.appendChild(plusH);
          }
          plots.forEach(function (p) {
            const btn = document.createElement("button");
            btn.type = "button";
            const ha = drawnHa(p);
            btn.setAttribute("data-chip-plot", p.id);
            btn.className = "map-chip" + (p.id === selectedId ? " is-on" : "") + (p.geom_json ? "" : " is-empty");
            btn.textContent = p.name + (ha != null ? " · " + ha + " ha" : "");
            btn.onclick = function () {
              selectedId = p.id;
              selectedHoldingId = p.holding_id || null;
              moveMode = false;
              fillChips();
              markList();
              const hit = overlays.find(function (o) { return o.plot.id === p.id; });
              if (hit) {
                const b = new google.maps.LatLngBounds();
                hit.poly.getPath().forEach(function (ll) { b.extend(ll); });
                map.fitBounds(b, 48);
                setEditable(p.id, null);
                if (isAdmin()) setMsg(t("land_map_editing"));
              } else {
                setMsg(isAdmin() ? t("land_map_draw_this") : t("land_map_no_shape"));
              }
            };
            box.appendChild(btn);
          });
          if (isAdmin()) {
            const plus = document.createElement("button");
            plus.type = "button";
            plus.className = "map-chip map-chip-new" + (!selectedId && !selectedHoldingId ? " is-on" : "");
            plus.textContent = "+ " + t("land_map_new");
            plus.onclick = function () {
              selectedId = null;
              fillChips();
              startDraw("plot");
            };
            box.appendChild(plus);
          }
          fillTotal();
          fillBook();
          markList();
        }

        function bindVertexEdit(poly, onSave) {
          poly.addListener("rightclick", function (ev) {
            if (!isAdmin() || !poly.getEditable()) return;
            const path = poly.getPath();
            if (path.getLength() <= 3 || !ev.latLng) return;
            let best = -1, bestD = 1e9;
            for (let i = 0; i < path.getLength(); i++) {
              const d = google.maps.geometry.spherical.computeDistanceBetween(ev.latLng, path.getAt(i));
              if (d < bestD) { bestD = d; best = i; }
            }
            if (best >= 0 && bestD < 22) { path.removeAt(best); onSave(); }
          });
        }

        function clearMoveHandle() {
          if (moveHandle) { moveHandle.setMap(null); moveHandle = null; }
          moveStart = null;
          setMapGrab(true);
        }

        function selectedPoly() {
          if (selectedHoldingId) {
            const ov = holdOverlays.find(function (o) { return o.holding.id === selectedHoldingId; });
            return ov ? ov.poly : null;
          }
          if (selectedId) {
            const ov = overlays.find(function (o) { return o.plot.id === selectedId; });
            return ov ? ov.poly : null;
          }
          return null;
        }

        function placeMoveHandle(poly) {
          clearMoveHandle();
          if (!poly || !isAdmin() || !moveMode) return;
          const path = [];
          poly.getPath().forEach(function (ll) { path.push({ lat: ll.lat(), lng: ll.lng() }); });
          const c = centroidOf(path);
          moveHandle = new google.maps.Marker({
            position: c,
            map: map,
            draggable: true,
            zIndex: 30,
            title: t("land_map_move"),
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 10,
              fillColor: "#f4f1e8",
              fillOpacity: 1,
              strokeColor: "#101218",
              strokeWeight: 2
            }
          });
          moveHandle.addListener("dragstart", function () {
            moveStart = [];
            poly.getPath().forEach(function (ll) { moveStart.push({ lat: ll.lat(), lng: ll.lng() }); });
            setMapGrab(false);
          });
          moveHandle.addListener("drag", function (ev) {
            if (!moveStart || !ev.latLng) return;
            const origin = centroidOf(moveStart);
            const dLat = ev.latLng.lat() - origin.lat;
            const dLng = ev.latLng.lng() - origin.lng;
            const path = poly.getPath();
            ignorePath++;
            const n = Math.min(moveStart.length, path.getLength());
            for (let i = 0; i < n; i++) {
              path.setAt(i, new google.maps.LatLng(moveStart[i].lat + dLat, moveStart[i].lng + dLng));
            }
            ignorePath--;
            const ov = overlays.find(function (o) { return o.poly === poly; }) ||
              holdOverlays.find(function (o) { return o.poly === poly; });
            if (ov) labelAtPoly(ov);
          });
          moveHandle.addListener("dragend", function () {
            setMapGrab(true);
            if (selectedHoldingId) saveHoldingPoly(poly, selectedHoldingId);
            else if (selectedId) savePoly(poly, selectedId);
          });
        }

        function setEditable(plotId, holdId) {
          selectedId = plotId;
          if (holdId) selectedHoldingId = holdId;
          if (plotId) selectedHoldingId = (plots.find(function (p) { return p.id === plotId; }) || {}).holding_id || selectedHoldingId;
          fillChips();
          markList();
          overlays.forEach(function (o) {
            const on = !!(isAdmin() && o.plot.id === plotId && !moveMode);
            o.poly.setEditable(on);
            o.poly.setOptions({
              strokeWeight: o.plot.id === plotId ? 3.5 : 2,
              zIndex: o.plot.id === plotId ? 4 : 2
            });
          });
          holdOverlays.forEach(function (o) {
            const on = !!(isAdmin() && o.holding.id === selectedHoldingId && !plotId && !moveMode);
            o.poly.setEditable(on);
            o.poly.setOptions({ strokeWeight: o.holding.id === selectedHoldingId && !plotId ? 4 : 2.5 });
          });
          const poly = selectedPoly();
          if (moveMode) placeMoveHandle(poly);
          else clearMoveHandle();
        }

        function watchPath(poly, plotId) {
          const later = pathLater(function () { savePoly(poly, plotId); });
          bindPath(poly, later);
          return later;
        }

        function clearOverlays() {
          pathEpoch++;
          overlays.forEach(function (o) {
            o.poly.setMap(null);
            if (o.label) o.label.setMap(null);
          });
          overlays.length = 0;
          info.close();
        }
        function clearHoldOverlays() {
          pathEpoch++;
          holdOverlays.forEach(function (o) {
            o.poly.setMap(null);
            if (o.label) o.label.setMap(null);
          });
          holdOverlays.length = 0;
        }

        function sampleLine(data) {
          const bits = [];
          if (data.elevation_m != null) bits.push(data.elevation_m + " m");
          if (data.weather && data.weather.temp_c != null) {
            bits.push(data.weather.temp_c + " °C" + (data.weather.condition ? " " + data.weather.condition : ""));
          }
          if (data.air && data.air.aqi != null) bits.push("AQI " + data.air.aqi);
          if (data.pollen && data.pollen.summary) bits.push(data.pollen.summary);
          return bits.join(" · ");
        }

        function openPlotCard(plot, poly, at, extra) {
          const n = haOf(poly);
          const loc = holdingById(plot.holding_id);
          let html = "<div class='map-card'><strong>" + esc(plot.name) + "</strong>";
          html += "<div class='dim'>" + esc(loc ? loc.name : "—") + " · " + esc(useLabel(plot.use_type)) + (n != null ? " · " + n + " ha" : "") + "</div>";
          (plot.plantings || []).forEach(function (pl) {
            html += "<div>" + esc(pl.crop) + (pl.stage ? " · " + esc(pl.stage) : "") + "</div>";
          });
          (plot.zones || []).forEach(function (z) {
            html += "<div><a href='/water'>" + esc(z.name) + " · " + esc(z.kind) + "</a></div>";
          });
          if (plot.use_type === "pond") html += "<div><a href='/water#akumulacija'>" + esc(t("land_map_pond_open")) + "</a></div>";
          if (extra) html += "<div class='dim'>" + esc(extra) + "</div>";
          if (isAdmin()) {
            html += "<button type='button' class='map-card-del' id='map-card-move'>" + esc(t("land_map_move")) + "</button> ";
            html += "<button type='button' class='map-card-del' id='map-card-del'>" + esc(t("land_map_delete")) + "</button> ";
            html += "<button type='button' class='map-card-del' id='map-card-kill'>" + esc(t("land_map_delete_plot")) + "</button>";
          }
          html += "</div>";
          info.setContent(html);
          info.setPosition(at);
          info.open(map);
          google.maps.event.addListenerOnce(info, "domready", function () {
            const mv = document.getElementById("map-card-move");
            if (mv) mv.onclick = function () { info.close(); startMove(); };
            const del = document.getElementById("map-card-del");
            if (del) del.onclick = function () { deleteShape(plot.id); };
            const kill = document.getElementById("map-card-kill");
            if (kill) kill.onclick = function () { deletePlot(plot.id); };
          });
        }

        function openHoldingCard(h, at) {
          const ov = holdOverlays.find(function (o) { return o.holding.id === h.id; });
          const ha = ov ? haOf(ov.poly) : h.hectares;
          let html = "<div class='map-card'><strong>" + esc(h.name) + "</strong>";
          html += "<div class='dim'>" + esc(t("land_map_holding_kind")) + (ha != null ? " · " + ha + " ha" : "") + "</div>";
          if (isAdmin()) {
            html += "<button type='button' class='map-card-del' id='map-hold-move'>" + esc(t("land_map_move")) + "</button> ";
            html += "<button type='button' class='map-card-del' id='map-hold-edit'>" + esc(t("land_map_edit")) + "</button> ";
            html += "<button type='button' class='map-card-del' id='map-hold-del'>" + esc(t("land_map_holding_delete")) + "</button>";
          }
          html += "</div>";
          info.setContent(html);
          info.setPosition(at);
          info.open(map);
          google.maps.event.addListenerOnce(info, "domready", function () {
            const mv = document.getElementById("map-hold-move");
            if (mv) mv.onclick = function () { info.close(); startMove(); };
            const ed = document.getElementById("map-hold-edit");
            if (ed) ed.onclick = function () {
              info.close();
              moveMode = false;
              setEditable(null, h.id);
              setMsg(t("land_map_editing"));
            };
            const del = document.getElementById("map-hold-del");
            if (del) del.onclick = function () { deleteHolding(h.id); };
          });
        }

        function renderHoldings() {
          clearHoldOverlays();
          holdings.forEach(function (h) {
            const ring = ringOf(h);
            if (!ring) return;
            const path = ringToPath(ring);
            const poly = new google.maps.Polygon({
              paths: path,
              strokeColor: "#f4f1e8",
              strokeOpacity: 0.95,
              strokeWeight: 3,
              fillColor: "#f4f1e8",
              fillOpacity: 0.05,
              geodesic: true,
              clickable: true,
              editable: false,
              zIndex: 1,
              map: map
            });
            poly.addListener("click", function (ev) {
              skipMapClick = true;
              selectedHoldingId = h.id;
              selectedId = null;
              setEditable(null, h.id);
              if (isAdmin()) setMsg(moveMode ? t("land_map_move_hint") : t("land_map_editing"));
              openHoldingCard(h, ev.latLng);
            });
            const label = new google.maps.Marker({
              position: centroidOf(path),
              map: map,
              clickable: false,
              zIndex: 5,
              icon: { path: google.maps.SymbolPath.CIRCLE, scale: 0 },
              label: { text: h.name, color: "#f0f0fa", fontSize: "13px", fontWeight: "700", className: "plot-label plot-label-hold" }
            });
            const later = pathLater(function () { saveHoldingPoly(poly, h.id); });
            bindPath(poly, later);
            bindVertexEdit(poly, later);
            holdOverlays.push({ holding: h, poly: poly, label: label, later: later });
          });
        }

        function renderPlots(fit) {
          clearOverlays();
          const bounds = new google.maps.LatLngBounds();
          let any = false;
          plots.forEach(function (p) {
            if (!p.geom_json) return;
            let g;
            try { g = JSON.parse(p.geom_json); } catch (e) { return; }
            if (!g || !g.coordinates || !g.coordinates[0]) return;
            const path = ringToPath(g.coordinates[0]);
            const poly = new google.maps.Polygon({
              paths: path,
              strokeColor: colorFor(p.use_type),
              fillColor: colorFor(p.use_type),
              strokeWeight: 2,
              fillOpacity: 0.4,
              zIndex: 2,
              map: map,
              clickable: true
            });
            poly.addListener("click", function (ev) {
              skipMapClick = true;
              setEditable(p.id, p.holding_id);
              openPlotCard(p, poly, ev.latLng);
              probe(ev.latLng, function (data) { openPlotCard(p, poly, ev.latLng, sampleLine(data)); });
            });
            path.forEach(function (ll) { bounds.extend(ll); any = true; });
            const label = new google.maps.Marker({
              position: centroidOf(path),
              map: map,
              clickable: false,
              icon: { path: google.maps.SymbolPath.CIRCLE, scale: 0 },
              label: { text: p.name, color: "#0b1a12", fontSize: "12px", fontWeight: "700", className: "plot-label" }
            });
            const later = watchPath(poly, p.id);
            bindVertexEdit(poly, later);
            overlays.push({ plot: p, poly: poly, label: label, later: later });
          });
          holdOverlays.forEach(function (o) {
            o.poly.getPath().forEach(function (ll) { bounds.extend(ll); any = true; });
          });
          if (selectedId && !plots.some(function (p) { return p.id === selectedId; })) selectedId = null;
          fillChips();
          if (selectedHoldingId) setEditable(null, selectedHoldingId);
          else if (selectedId) setEditable(selectedId, null);
          else markList();
          if (fit && any) map.fitBounds(bounds, 56);
        }

        function applyRemoteLand(msg) {
          if (!msg || msg.origin === landOrigin) return;
          if (msg.reload) {
            loadPlots(false);
            return;
          }
          if (msg.plot && msg.plot.id) {
            const data = msg.plot;
            if (data.geom_json === null) {
              loadPlots(false);
              return;
            }
            if (selectedId === data.id && (moveMode || ignorePath)) return;
            const i = plots.findIndex(function (p) { return p.id === data.id; });
            if (i >= 0) {
              if (data.geom_json !== undefined) plots[i].geom_json = data.geom_json;
              if (data.hectares !== undefined) plots[i].hectares = data.hectares;
              if (data.holding_id !== undefined) plots[i].holding_id = data.holding_id;
            }
            const ov = overlays.find(function (o) { return o.plot.id === data.id; });
            if (ov && data.geom_json) {
              try {
                const g = JSON.parse(data.geom_json);
                if (g && g.coordinates && g.coordinates[0]) setPolyRing(ov, g.coordinates[0]);
              } catch (e) {}
              labelAtPoly(ov);
              fillChips();
            } else if (!ov && data.geom_json) loadPlots(false);
            else fillChips();
          }
          if (msg.holding && msg.holding.id) {
            if (selectedHoldingId === msg.holding.id && (moveMode || ignorePath)) return;
            const data = msg.holding;
            const i = holdings.findIndex(function (h) { return h.id === data.id; });
            if (i >= 0) {
              if (data.geom_json !== undefined) holdings[i].geom_json = data.geom_json;
              if (data.hectares !== undefined) holdings[i].hectares = data.hectares;
              if (data.name) holdings[i].name = data.name;
            }
            const ov = holdOverlays.find(function (o) { return o.holding.id === data.id; });
            if (ov && data.geom_json) {
              try {
                const g = JSON.parse(data.geom_json);
                if (g && g.coordinates && g.coordinates[0]) setPolyRing(ov, g.coordinates[0]);
              } catch (e) {}
              labelAtPoly(ov);
              fillChips();
            } else if (!ov && data.geom_json) loadPlots(false);
            else fillChips();
          }
        }

        function connectLandLive() {
          try {
            const proto = location.protocol === "https:" ? "wss:" : "ws:";
            const ws = new WebSocket(proto + "//" + location.host + "/v1/live?farm=" + encodeURIComponent(FARM));
            ws.onmessage = function (ev) {
              if (ev.data === "pong") return;
              try {
                const msg = JSON.parse(ev.data);
                if (msg && msg.type === "land") applyRemoteLand(msg);
              } catch (e) {}
            };
            setInterval(function () { if (ws.readyState === 1) ws.send("ping"); }, 25000);
          } catch (e) {}
        }

        async function loadPlots(fit) {
          const res = await fetch("/v1/plots?farm=" + encodeURIComponent(FARM), { credentials: "include" });
          if (!res.ok) return;
          const data = await res.json();
          holdings = data.holdings || (data.holding ? [data.holding] : []);
          plots = data.plots || [];
          renderHoldings();
          renderPlots(fit !== false);
        }

        async function savePoly(poly, plotId, holdingId) {
          if (!isAdmin()) return;
          const id = plotId || selectedId;
          if (!id) return setMsg(t("land_map_need_plot"), true);
          if (!poly || poly.getPath().getLength() < 3) return;
          const ov = overlays.find(function (o) { return o.plot.id === id; });
          const lastGood = ov && ov.plot ? ov.plot.geom_json : null;
          const tok = (saveTok[id] = (saveTok[id] || 0) + 1);
          const geo = pathToGeo(poly);
          const body = { geom_json: JSON.stringify(geo) };
          if (holdingId) body.holding_id = holdingId;
          const res = await fetch("/v1/plots/" + id, {
            method: "PATCH",
            credentials: "include",
            headers: landHeaders(),
            body: JSON.stringify(body)
          });
          const data = await res.json().catch(function () { return {}; });
          if (tok !== saveTok[id]) return;
          if (!res.ok) {
            if (data.error === "outside_holding") {
              setMsg(t("land_map_outside"), true);
              if (lastGood && ov) {
                try {
                  const g = JSON.parse(lastGood);
                  if (g && g.coordinates && g.coordinates[0]) setPolyRing(ov, g.coordinates[0]);
                } catch (e) {}
                labelAtPoly(ov);
              } else {
                loadPlots(false);
              }
              return;
            }
            return setMsg(data.error || res.statusText, true);
          }
          selectedId = id;
          if (ov && ov.plot) {
            ov.plot.geom_json = data.geom_json;
            ov.plot.hectares = data.hectares;
            if (data.holding_id !== undefined) ov.plot.holding_id = data.holding_id;
            labelAtPoly(ov);
            fillChips();
          } else {
            loadPlots(false);
          }
          setMsg(t("land_map_saved", { ha: data.hectares != null ? data.hectares : "—" }));
        }

        async function saveHoldingPoly(poly, holdId) {
          if (!isAdmin() || !poly) return;
          const id = holdId || selectedHoldingId;
          if (!id) return;
          if (poly.getPath().getLength() < 3) return;
          const ov = holdOverlays.find(function (o) { return o.holding.id === id; });
          const lastGood = ov && ov.holding ? ov.holding.geom_json : null;
          const tok = (saveTok["h:" + id] = (saveTok["h:" + id] || 0) + 1);
          const geo = pathToGeo(poly);
          const h = holdingById(id);
          const res = await fetch("/v1/holdings/" + id, {
            method: "PATCH",
            credentials: "include",
            headers: landHeaders(),
            body: JSON.stringify({ geom_json: JSON.stringify(geo), name: h && h.name })
          });
          const data = await res.json().catch(function () { return {}; });
          if (tok !== saveTok["h:" + id]) return;
          if (!res.ok) {
            setMsg(data.error || res.statusText, true);
            if (lastGood && ov) {
              try {
                const g = JSON.parse(lastGood);
                if (g && g.coordinates && g.coordinates[0]) setPolyRing(ov, g.coordinates[0]);
              } catch (e) {}
              labelAtPoly(ov);
            }
            return;
          }
          selectedHoldingId = id;
          if (ov && ov.holding) {
            ov.holding.geom_json = data.geom_json;
            ov.holding.hectares = data.hectares;
            labelAtPoly(ov);
            fillChips();
          } else {
            loadPlots(false);
          }
          setMsg(t("land_map_holding_saved", { ha: data.hectares != null ? data.hectares : "—" }));
        }

        async function deleteHolding(id) {
          if (!isAdmin()) return;
          if (!confirm(t("land_map_holding_delete_confirm"))) return;
          info.close();
          const res = await fetch("/v1/holdings/" + id, {
            method: "DELETE",
            credentials: "include",
            headers: landHeaders(),
            body: JSON.stringify({ confirm: true })
          });
          const data = await res.json().catch(function () { return {}; });
          if (!res.ok) return setMsg(data.error || res.statusText, true);
          selectedHoldingId = null;
          setMsg(t("land_map_holding_deleted"));
          loadPlots(true);
        }

        async function deleteShape(plotId) {
          if (!isAdmin()) return;
          if (!confirm(t("land_map_delete_confirm"))) return;
          info.close();
          const res = await fetch("/v1/plots/" + plotId, {
            method: "PATCH",
            credentials: "include",
            headers: landHeaders(),
            body: JSON.stringify({ geom_json: null })
          });
          const data = await res.json().catch(function () { return {}; });
          if (!res.ok) return setMsg(data.error || res.statusText, true);
          setMsg(t("land_map_deleted"));
          loadPlots(true);
        }

        async function deletePlot(plotId) {
          if (!isAdmin()) return;
          if (!confirm(t("land_map_delete_plot_confirm"))) return;
          info.close();
          const res = await fetch("/v1/plots/" + plotId, {
            method: "DELETE",
            credentials: "include",
            headers: landHeaders(),
            body: JSON.stringify({ confirm: true })
          });
          const data = await res.json().catch(function () { return {}; });
          if (!res.ok) return setMsg(data.error || res.statusText, true);
          selectedId = null;
          setMsg(t("land_map_plot_deleted"));
          location.reload();
        }

        async function saveNewField() {
          if (!isAdmin() || !pendingGeo) return;
          const nameEl = document.getElementById("map-new-name");
          const useEl = document.getElementById("map-new-use");
          const name = (nameEl && nameEl.value || "").trim();
          if (!name) return setMsg(pendingHolding ? t("land_map_holding_name") : t("land_map_name_new"), true);
          setMsg(t("loading"));
          if (pendingHolding) {
            const res = await fetch("/v1/holdings", {
              method: "POST",
              credentials: "include",
              headers: landHeaders(),
              body: JSON.stringify({ farm_slug: FARM, name: name, geom_json: JSON.stringify(pendingGeo) })
            });
            const data = await res.json().catch(function () { return {}; });
            if (!res.ok) return setMsg(data.error || res.statusText, true);
            cancelPending();
            selectedHoldingId = data.id || null;
            selectedId = null;
            setMsg(t("land_map_holding_saved", { ha: data.hectares != null ? data.hectares : "—" }));
            loadPlots(true);
            return;
          }
          const res = await fetch("/v1/plots", {
            method: "POST",
            credentials: "include",
            headers: landHeaders(),
            body: JSON.stringify({
              farm_slug: FARM,
              name: name,
              use_type: pendingUse || (useEl && useEl.value) || "other",
              geom_json: JSON.stringify(pendingGeo),
              holding_id: clipHolding && clipHolding.id ? clipHolding.id : undefined
            })
          });
          const data = await res.json().catch(function () { return {}; });
          if (!res.ok) {
            if (data.error === "outside_holding") return setMsg(t("land_map_outside"), true);
            return setMsg(data.error || res.statusText, true);
          }
          cancelPending();
          selectedId = data.id || null;
          location.reload();
        }

        function startMove() {
          if (!isAdmin()) return setMsg(t("op_off"), true);
          if (drawing) return;
          if (!selectedId && !selectedHoldingId) {
            if (holdings.length) {
              selectedHoldingId = holdings[0].id;
            } else return setMsg(t("land_map_need_holding"), true);
          }
          moveMode = true;
          setEditable(selectedId, selectedHoldingId);
          setMsg(t("land_map_move_hint"));
          syncDrawBtn();
        }

        function startAdjust() {
          if (!isAdmin()) return setMsg(t("op_off"), true);
          moveMode = false;
          if (selectedId) setEditable(selectedId, null);
          else if (selectedHoldingId) setEditable(null, selectedHoldingId);
          else if (holdings.length) setEditable(null, holdings[0].id);
          else return setMsg(t("land_map_need_holding"), true);
          setMsg(t("land_map_editing"));
          syncDrawBtn();
        }

        const btnHold = document.getElementById("map-holding");
        if (btnHold) btnHold.onclick = function () { startDraw("holding"); };
        const btnDraw = document.getElementById("map-draw");
        if (btnDraw) btnDraw.onclick = function () { pendingUse = null; startDraw("plot"); };
        const btnPond = document.getElementById("map-pond");
        if (btnPond) btnPond.onclick = function () {
          pendingUse = "pond";
          const useEl = document.getElementById("map-new-use");
          if (useEl) useEl.value = "pond";
          startDraw("plot");
          if (drawing) setMsg(t("land_map_pond_draw"));
        };
        const btnEq = document.getElementById("map-equip");
        if (btnEq) btnEq.onclick = function () {
          pendingUse = "equipment";
          const useEl = document.getElementById("map-new-use");
          if (useEl) useEl.value = "equipment";
          startDraw("plot");
          if (drawing) setMsg(t("land_map_equip_draw"));
        };
        const btnUndo = document.getElementById("map-undo");
        if (btnUndo) btnUndo.onclick = function () { if (drawing) undoDraft(); };
        const btnCancel = document.getElementById("map-cancel");
        if (btnCancel) btnCancel.onclick = function () {
          if (drawing) { clearDraft(); setMsg(""); }
          else cancelPending();
        };
        const btnDone = document.getElementById("map-done");
        if (btnDone) btnDone.onclick = function () { if (drawing) finishDraft(); };
        const btnEdit = document.getElementById("map-edit");
        if (btnEdit) btnEdit.onclick = startAdjust;
        const btnMove = document.getElementById("map-move");
        if (btnMove) btnMove.onclick = startMove;
        const btnNew = document.getElementById("map-new-save");
        if (btnNew) btnNew.onclick = saveNewField;

        document.querySelectorAll("[data-plot-id]").forEach(function (el) {
          el.addEventListener("click", function () {
            const id = el.getAttribute("data-plot-id");
            if (!id) return;
            selectedId = id;
            selectedHoldingId = null;
            fillChips();
            const hit = overlays.find(function (o) { return o.plot.id === id; });
            if (hit) {
              const b = new google.maps.LatLngBounds();
              hit.poly.getPath().forEach(function (ll) { b.extend(ll); });
              map.fitBounds(b, 48);
              setEditable(id, null);
            } else {
              markList();
              setMsg(isAdmin() ? t("land_map_draw_this") : t("land_map_no_shape"));
            }
          });
        });

        document.addEventListener("keydown", function (e) {
          const tag = (e.target && e.target.tagName) || "";
          if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
          if (e.key === "Escape") {
            if (drawing) { clearDraft(); setMsg(""); }
            else if (pendingGeo) cancelPending();
            else if (moveMode) { moveMode = false; setEditable(selectedId, selectedHoldingId); setMsg(""); }
          }
          if ((e.key === "Backspace" || e.key === "Delete") && drawing) {
            e.preventDefault();
            undoDraft();
          }
          if (e.key === "Enter" && drawing && draftPts.length >= 3) {
            e.preventDefault();
            finishDraft();
          }
        });

        const search = document.getElementById("map-search");
        function geocodeQuery() {
          const q = (search && search.value) || "";
          if (!q) return;
          const geo = new google.maps.Geocoder();
          geo.geocode({ address: q, region: "HR" }, function (results, status) {
            if (status !== "OK" || !results || !results[0]) return setMsg(t("land_map_no_place"), true);
            const r = results[0];
            goToPlace(map, r.geometry.location, r.geometry.viewport);
            setMsg("");
          });
        }
        if (search) {
          search.addEventListener("keydown", function (e) {
            if (e.key === "Enter") { e.preventDefault(); geocodeQuery(); }
          });
          if (google.maps.places && google.maps.places.Autocomplete) {
            try {
              const ac = new google.maps.places.Autocomplete(search, {
                fields: ["geometry", "name"],
                componentRestrictions: { country: "hr" }
              });
              ac.bindTo("bounds", map);
              ac.addListener("place_changed", function () {
                const place = ac.getPlace();
                if (!place.geometry || !place.geometry.location) return geocodeQuery();
                goToPlace(map, place.geometry.location, place.geometry.viewport);
                setMsg("");
              });
            } catch (e) { console.warn("places autocomplete", e); }
          }
        }
        const btnGo = document.getElementById("map-go");
        if (btnGo) btnGo.onclick = geocodeQuery;

        async function probe(ll, then) {
          try {
            const res = await fetch(
              "/v1/maps/sample?farm=" + encodeURIComponent(FARM) +
              "&lat=" + ll.lat() + "&lon=" + ll.lng() +
              "&lang=" + (typeof LANG !== "undefined" ? LANG : "en")
            );
            const data = await res.json();
            if (!res.ok) return;
            if (then) then(data);
          } catch (e) {}
        }

        map.addListener("mousedown", function (ev) {
          if (!ev.latLng) return;
          pointerDown = { x: ev.pixel ? ev.pixel.x : 0, y: ev.pixel ? ev.pixel.y : 0, ll: ev.latLng, t: Date.now() };
        });
        map.addListener("mouseup", function (ev) {
          if (!drawing || !pointerDown || !ev.latLng) { pointerDown = null; return; }
          const dx = ev.pixel && pointerDown.x != null ? ev.pixel.x - pointerDown.x : 0;
          const dy = ev.pixel && pointerDown.y != null ? ev.pixel.y - pointerDown.y : 0;
          pointerDown = null;
          if (Math.hypot(dx, dy) > 12) return;
          addDraftPt(ev.latLng);
          skipMapClick = true;
        });
        map.addListener("mousemove", function (ev) {
          if (!drawing || !ev.latLng || !draftPts.length) {
            if (ghostLine && (!drawing || !draftPts.length)) { ghostLine.setMap(null); ghostLine = null; }
            return;
          }
          const clamped = clampToHolding(ev.latLng);
          const ll = clamped || ev.latLng;
          const ghostPath = [draftPts[draftPts.length - 1], ll];
          if (draftPts.length >= 2) ghostPath.push(draftPts[0]);
          if (!ghostLine) {
            ghostLine = new google.maps.Polyline({
              path: ghostPath,
              strokeColor: drawKind === "holding" ? "#f4f1e8" : "#005288",
              strokeOpacity: 0.45,
              strokeWeight: 1.5,
              geodesic: true,
              map: map,
              clickable: false,
              zIndex: 15
            });
          } else ghostLine.setPath(ghostPath);
        });
        map.addListener("click", function (ev) {
          if (drawing) return;
          if (skipMapClick) { skipMapClick = false; return; }
          if (!ev.latLng) return;
          info.setContent("<div class='map-card dim'>…</div>");
          info.setPosition(ev.latLng);
          info.open(map);
          probe(ev.latLng, function (data) {
            info.setContent("<div class='map-card'>" + esc(sampleLine(data) || "—") + "</div>");
          });
        });
        map.addListener("dblclick", function (ev) {
          if (!drawing) return;
          if (ev && ev.stop) ev.stop();
          if (draftPts.length > 3) {
            draftPts.pop();
            if (draftLine) draftLine.setPath(draftPts);
          }
          finishDraft();
        });
        map.addListener("idle", function () { saveView(map); });

        connectLandLive();
        loadPlots(true);
        document.addEventListener("polje:lang", function () { fillChips(); syncDrawBtn(); });
        window.poljeOnLogin = function () { fillChips(); syncDrawBtn(); };
        setTimeout(function () { google.maps.event.trigger(map, "resize"); }, 400);
      }
    })();
`.trim();
