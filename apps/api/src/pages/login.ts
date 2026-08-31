import type { Context } from "hono";
import {
  bootScripts,
  escapeHtml,
  pageOpen,
  SHARE_DESC,
  shareHead,
} from "../lib/html";
import { farmFromRequest } from "../lib/farm";
import { isOperator, safeNextPath } from "../lib/auth";
import { weatherNow } from "../lib/weather";

type AppEnv = { Bindings: Cloudflare.Env };

export async function renderLogin(c: Context<AppEnv>) {
  const { slug, farm, defaultSlug } = await farmFromRequest(c);
  const next = safeNextPath(c.req.query("next"));
  if (await isOperator(c)) {
    return c.redirect(next, 302);
  }

  const name = farm?.name ?? "Polje";
  const wxSkin = weatherNow(farm?.timezone ?? "Europe/Zagreb", null);
  return c.html(`${pageOpen({
    title: `Sign in · ${name}`,
    farmName: name,
    farmSlug: slug,
    defaultSlug,
    currentPath: "/login",
    pipHtml: `<span class="pip ok">ADMIN</span>`,
    extraHead: shareHead(c.req.url, `Sign in · ${name}`, SHARE_DESC),
    extraCss: `.login-box { max-width: 420px; }`,
    solar: wxSkin.solar,
    wx: wxSkin.wx,
  })}
  <main>
    <h1 data-i18n="login_title">Sign in</h1>
    <p class="sub" data-i18n="login_sub">All pages are open. Sign-in is only for commands — water, climate, ledger, mail.</p>
    <section class="panel login-box">
      <form id="form-login">
        <label for="email">Email</label>
        <input id="email" name="email" type="email" autocomplete="username" required />
        <label for="password" data-i18n="login_password">Password</label>
        <input id="password" name="password" type="password" autocomplete="current-password" required />
        <div class="actions">
          <button class="btn-ghost" type="submit" data-i18n="login_open">Open admin</button>
        </div>
        <div class="msg" id="msg"></div>
      </form>
    </section>
    <footer data-i18n="login_footer">Cookie 30 days · secret in Cloudflare, not in git</footer>
  </main>
  </div>
  ${bootScripts()}
  <script>
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
        if (!res.ok) throw new Error(data.error === "unauthorized" ? t("login_bad") : (data.error || res.statusText));
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
