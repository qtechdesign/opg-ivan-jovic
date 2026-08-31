import type { Context } from "hono";
import {
  CHASSIS_CSS,
  escapeHtml,
  farmBrand,
  FARM_SLUG_JS,
  siteNav,
} from "../lib/html";
import { farmFromRequest } from "../lib/farm";
import { isOperator, safeNextPath } from "../lib/auth";

type AppEnv = { Bindings: Cloudflare.Env };

export async function renderLogin(c: Context<AppEnv>) {
  const { slug, farm, defaultSlug } = await farmFromRequest(c);
  const next = safeNextPath(c.req.query("next"));
  if (await isOperator(c)) {
    return c.redirect(next, 302);
  }

  const name = farm?.name ?? "Polje";
  return c.html(`<!DOCTYPE html>
<html lang="hr" data-solar="day" data-wx="clear" data-farm="${escapeHtml(slug)}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Prijava · ${escapeHtml(name)}</title>
  <style>${CHASSIS_CSS}
  .login-box { max-width: 420px; }
  </style>
</head>
<body>
  <header>
    ${farmBrand(name, slug, defaultSlug)}
    ${siteNav(slug, defaultSlug)}
    <span class="pip ok">ADMIN</span>
  </header>
  <main>
    <h1>Prijava</h1>
    <p class="sub">Sve stranice su otvorene. Prijava je samo za naredbe — voda, klima, knjiga, pošta.</p>
    <section class="panel login-box">
      <form id="form-login">
        <label for="email">Email</label>
        <input id="email" name="email" type="email" autocomplete="username" required />
        <label for="password">Lozinka</label>
        <input id="password" name="password" type="password" autocomplete="current-password" required />
        <div class="actions">
          <button class="btn-ghost" type="submit">Otvori admin</button>
        </div>
        <div class="msg" id="msg"></div>
      </form>
    </section>
    <footer>Cookie 30 dana · tajna u Cloudflareu, ne u gitu</footer>
  </main>
  <script>
    ${FARM_SLUG_JS}
    const next = ${JSON.stringify(next)};
    document.getElementById("form-login").onsubmit = async (e) => {
      e.preventDefault();
      const msg = document.getElementById("msg");
      msg.textContent = "";
      msg.className = "msg";
      try {
        const res = await fetch("/v1/session", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: document.getElementById("email").value.trim(),
            password: document.getElementById("password").value
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error === "unauthorized" ? "Krivi email ili lozinka" : (data.error || res.statusText));
        location.href = next;
      } catch (err) {
        msg.textContent = String(err.message || err);
        msg.className = "msg err";
      }
    };
  </script>
</body>
</html>`);
}
