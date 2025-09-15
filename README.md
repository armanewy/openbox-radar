# Open-Box Radar — MVP Scaffold

This is a minimal scaffold for the Open-Box Radar MVP: a Next.js web app + Cloudflare Worker poller + Postgres (Supabase) + Drizzle ORM.

## What’s here
- `web/` — Next.js app (watch CRUD, auth stubs, landing)
- `worker/` — Cloudflare Worker (cron poller + retailer adapters)
- `db/` — Drizzle schema + seed placeholders
- `.env.example` — environment variables you’ll need

## Quick start

1) **Install prerequisites**
- Node 20+ and pnpm (or npm)
- Wrangler CLI (`npm i -g wrangler`)
- Create a Supabase project (or Postgres you host)

2) **Copy env and fill values**
```bash
cp .env.example .env
```

3) **Install deps & run web**
```bash
cd web
pnpm install
pnpm dev
```

4) **Run the worker locally**
```bash
cd ../worker
pnpm install
wrangler dev
```

5) **Create tables (Drizzle)**
Adjust the connection string in `web/lib/drizzle/drizzle.config.ts`, then:
```bash
cd web
pnpm drizzle:push
```

6) **Add search indexes (recommended for performance)**
Run the SQL in `db/sql/indexes.sql` against your database (e.g., via Supabase SQL editor or `psql`).

```sql
-- db/sql/indexes.sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_inventory_title_trgm ON inventory USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_inventory_sku_trgm   ON inventory USING gin (sku gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_inventory_seen_at ON inventory (seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_store   ON inventory (retailer, store_id);
```

## Deploy outline

- **Domain**: buy at Cloudflare or Namecheap; set Cloudflare for DNS.
- **Web**: deploy `web/` to Vercel; add your domain; set env vars.
- **DB**: Supabase Postgres; set `DATABASE_URL` in Vercel/Worker.
- **Email**: Postmark or Resend key in env.
- **Worker**: `wrangler deploy` + Cron Triggers (15/60 min) in `wrangler.toml`.

### Cloudflare Worker → Web Ingest (Option B)

The Worker scrapes retailers and POSTs items to the web app for ingestion.

1) Configure web (Vercel):
   - Set `CRON_SECRET` env var (same value you’ll use in the Worker as `CRON_SHARED_SECRET`).
   - Deploy web so `POST /api/ingest` is available.

2) Configure Worker:
   - Edit `worker/wrangler.toml` and set:
     - `CRON_SHARED_SECRET = "<same-as-CRON_SECRET>"`
     - `INGEST_URL = "https://<your-web-domain>/api/ingest"`
     - Adjust `[triggers].crons` as desired (e.g., every 10 minutes).
   - Install and deploy:
     ```bash
     cd worker
     pnpm install
     pnpm deploy
     ```

3) Test manually:
   - Invoke the Worker’s manual endpoint:
     ```bash
     curl -H "x-cron-secret: <CRON_SHARED_SECRET>" https://<your-worker-subdomain>.workers.dev/cron
     ```
   - Visit `/search` on your site and look for DEV items.

Notes:
- `web/app/api/ingest` accepts batches (up to 1000 items) and writes to `inventory` with normalized condition ranks. It requires `Authorization: Bearer <CRON_SECRET>` or `x-cron-secret: <CRON_SECRET>` in production.
- The current Worker adapters are stubs; replace with real BestBuy/MicroCenter scrapers next.

---

### Notes

- Retailer adapters are stubs—fill selectors as you implement.
- Magic-link auth is stubbed; you can swap in Supabase Auth easily.
- Keep polling polite; honor robots and add jitter/backoff.
