/** Compact admin strip. Pages are public; this only unlocks commands. */

export const OPERATOR_GATE_HTML = `<section class="panel no-print" id="op-gate">
      <div class="row">
        <span class="dim" id="op-hint">Admin · naredbe</span>
        <div class="actions" style="margin-top:0">
          <a class="btn-ghost" id="op-login-link" href="/login">Prijava</a>
          <button type="button" class="btn-ghost" id="op-logout" hidden>Odjavi se</button>
        </div>
      </div>
    </section>`;

export const OPERATOR_SESSION_JS = `
    async function opRefreshGate() {
      const hint = document.getElementById("op-hint");
      const loginLink = document.getElementById("op-login-link");
      const logoutBtn = document.getElementById("op-logout");
      if (loginLink) {
        loginLink.href = "/login?next=" + encodeURIComponent(location.pathname + location.search);
      }
      try {
        const res = await fetch("/v1/session", { credentials: "include" });
        const data = await res.json();
        const on = !!data.operator;
        document.body.classList.toggle("is-admin", on);
        if (loginLink) loginLink.hidden = on;
        if (logoutBtn) logoutBtn.hidden = !on;
        if (hint) hint.textContent = on ? "Prijavljen · naredbe otvorene." : "Gledanje otvoreno · prijava samo za naredbe.";
        if (on && typeof window.poljeOnLogin === "function") window.poljeOnLogin();
        return on;
      } catch (e) {
        document.body.classList.remove("is-admin");
        return false;
      }
    }
    const logoutBtn = document.getElementById("op-logout");
    if (logoutBtn) {
      logoutBtn.onclick = async () => {
        await fetch("/v1/session", { method: "DELETE", credentials: "include" });
        location.reload();
      };
    }
`.trim();
