/** Login once; HttpOnly cookie. Password = Cloudflare OPERATOR_TOKEN. */

export const OPERATOR_GATE_HTML = `<section class="panel no-print" id="op-gate">
      <h2>Prijava</h2>
      <p class="dim" id="op-hint">Lozinka farme. Gosti samo gledaju. Jednom, pa 30 dana.</p>
      <form id="form-login">
        <label for="op-pass">Lozinka</label>
        <input id="op-pass" type="password" autocomplete="current-password" />
        <div class="actions">
          <button class="btn-ghost" type="submit" id="op-login">Prijavi se</button>
          <button class="btn-ghost" type="button" id="op-logout" hidden>Odjavi se</button>
        </div>
        <div class="msg" id="op-msg"></div>
      </form>
    </section>`;

export const OPERATOR_SESSION_JS = `
    async function opRefreshGate() {
      const hint = document.getElementById("op-hint");
      const pass = document.getElementById("op-pass");
      const loginBtn = document.getElementById("op-login");
      const logoutBtn = document.getElementById("op-logout");
      const msg = document.getElementById("op-msg");
      try {
        const res = await fetch("/v1/session", { credentials: "include" });
        const data = await res.json();
        const on = !!data.operator;
        if (pass) pass.hidden = on;
        if (loginBtn) loginBtn.hidden = on;
        if (logoutBtn) logoutBtn.hidden = !on;
        if (hint) hint.textContent = on
          ? "Prijavljen. Možeš raditi na farmi."
          : "Lozinka farme. Gosti samo gledaju. Jednom, pa 30 dana.";
        if (on && msg) { msg.textContent = ""; msg.className = "msg"; }
        return on;
      } catch (e) {
        return false;
      }
    }
    document.getElementById("form-login").onsubmit = async (e) => {
      e.preventDefault();
      const msg = document.getElementById("op-msg");
      const pass = document.getElementById("op-pass");
      try {
        const res = await fetch("/v1/session", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: pass.value })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error === "unauthorized" ? "Kriva lozinka" : (data.error || res.statusText));
        pass.value = "";
        msg.textContent = "OK.";
        msg.className = "msg";
        const on = await opRefreshGate();
        if (on && typeof window.poljeOnLogin === "function") window.poljeOnLogin();
      } catch (err) {
        msg.textContent = String(err.message || err);
        msg.className = "msg err";
      }
    };
    document.getElementById("op-logout").onclick = async () => {
      await fetch("/v1/session", { method: "DELETE", credentials: "include" });
      await opRefreshGate();
    };
`.trim();
