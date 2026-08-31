# Fork Polje for another OPG

Polje is MIT. First instance is **OPG Ivan Jović** (`farm_id` / slug `ivan-jovic`) at [opg-ivanjovic.hr](https://opg-ivanjovic.hr). This file is how another family farm copies the stack without inheriting Ivan’s land ledger, tokens, or Cloudflare bindings.

FPS credit: [qtechdesign/qtech](https://github.com/qtechdesign/qtech) (MIT) lives in `forks/qtech` when M4 is in the tree. Keep that NOTICE.

## Do not copy

These stay on this instance. Never commit them to your fork as if they were yours.

| Keep private | Why |
|---|---|
| `.dev.vars`, ingest / operator / agent tokens | Secrets |
| This D1 `database_id` | Another farm’s ledger |
| R2 bucket `polje-media` | Photos, receipts |
| Custom domains `opg-ivanjovic.hr` | This farm’s public face |
| RTSP URLs, camera GPS, bank data | Bible §3 |
| Mailbox `farm@opg-ivanjovic.hr` | Platform mailbox for this OPG |
| `OPERATOR_EMAIL` in `wrangler.jsonc` | This operator |

## Checklist

1. Fork the GitHub repo. License is MIT — keep copyright and FPS attribution.
2. New Cloudflare account (or a clean project): D1 database named `polje`, R2 bucket, Queue `polje-ingest`, Durable Object class `FarmRuntime`.
3. Copy [`wrangler.fork.example.jsonc`](../wrangler.fork.example.jsonc) over the live ids in `wrangler.jsonc`. Replace every `YOUR_*` placeholder. Do not paste Ivan’s `database_id` or routes.
4. Copy [`seed/demo-opg.json`](../seed/demo-opg.json) → `seed/<your-slug>.json` and [`seed/demo-opg.sql`](../seed/demo-opg.sql) → `seed/<your-slug>.sql`. Change slug, name, plot names. Device ids must stay **globally unique** (`devices.id` is a table PK). Do not invent hectares or GPS.
5. Set Worker var `DEFAULT_FARM_SLUG` to your slug. Edge: `FARM_ID=<slug>`, `POLJE_API=https://<your-worker>`. Schema Zod defaults in `packages/schema` still say `ivan-jovic` in this repo — change those if your fork is not Ivan.
6. Local:

   ```bash
   npm install
   cp .dev.vars.example .dev.vars   # your tokens, not Ivan’s
   npm run db:migrate:local
   node scripts/seed.mjs --farm=<your-slug>
   npm run dev
   ```

   Open `/land?farm=<your-slug>`. Default `/` uses `DEFAULT_FARM_SLUG`.
7. Bind your own domain later. Public hostnames in this repo stay `opg-ivanjovic.hr`.
8. Follow the same module order (M0→M10). Do not enable high-risk automations in seed.

`demo-opg` is **local and CI only**. `npm run seed:remote` applies `ivan-jovic` only and refuses `--farm=demo-opg`.

## Values you must replace

| Key | This instance | Your fork |
|---|---|---|
| `wrangler.jsonc` `d1_databases[0].database_id` | live D1 | new D1 |
| `r2_buckets[0].bucket_name` | `polje-media` | your bucket |
| `routes` | `opg-ivanjovic.hr` | your domain or omit until ready |
| `vars.DEFAULT_FARM_SLUG` | `ivan-jovic` | your slug |
| `vars.OPERATOR_EMAIL` | this operator | yours or omit |
| Edge `FARM_ID` | `ivan-jovic` | your slug |
| Edge `POLJE_API` | `https://opg-ivanjovic.hr` | your Worker URL |
| `packages/schema` `farm_slug` defaults | `ivan-jovic` | your slug |

## Two farms on one Worker

Schema always has `farm_id`. HTML and API take `?farm=<slug>`. This production site stays a **single tenant** (`ivan-jovic`). Local `wrangler dev` seeds both so `/land?farm=demo-opg` works.

If you run an OPG, open a GitHub issue with your crop mix.
