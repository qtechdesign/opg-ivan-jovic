/** Session: unlocks admin commands. No banner — login lives in nav, logout in the topbar. */

export const OPERATOR_SESSION_JS = `
    async function opRefreshGate() {
      try {
        const res = await fetch("/v1/session", { credentials: "include" });
        const data = await res.json();
        const on = !!data.operator;
        document.body.classList.toggle("is-admin", on);
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
    document.addEventListener("polje:lang", () => { opRefreshGate(); });
    opRefreshGate();
`.trim();
