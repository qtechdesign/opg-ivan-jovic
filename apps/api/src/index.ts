import { Hono } from "hono";
import { api } from "./routes/api";
import { renderHome, renderLand } from "./pages/land";

type Bindings = Cloudflare.Env;

const app = new Hono<{ Bindings: Bindings }>();

app.route("/", api);
app.get("/", (c) => renderHome(c));
app.get("/land", (c) => renderLand(c));

export default app;
