# Open‑Box Radar

Open‑Box Radar is a Next.js 14 app + Cloudflare Worker that collects open‑box deals, stores normalized snapshots in Postgres, and exposes fast search and browse. Best Buy uses the official Open Box API; Micro Center can be scraped via DOM. The UI is open to browse/search (no login). “Watch” and “Save search” use passwordless email (magic link).

## Repo layout
- `web/` — Next.js app (app router)
  - Drizzle ORM + Postgres (Supabase‑friendly)
  - API routes: `ingest`, `inventory/search`, `inventory/history`, `inventory/trending`, `watches`, `auth/*`, `analytics`
  - UI: search with sticky filters, Sort (Dropdown), Save search, infinite scroll, trending + drops carousels
- `worker/` — Cloudflare Worker
  - Schedules pulls from Best Buy (API) and Micro Center (DOM, optional)
  - POSTs normalized items to `web` `/api/ingest`
- `.env.example` — environment template

## Quick start (dev)
1) Prereqs
   - Node 20+, pnpm, Wrangler CLI
   - A Postgres DB (Supabase works great)

2) Configure env
   - Copy `.env.example` → `web/.env` and fill values
   - Important:
     - `DATABASE_URL` (Postgres)
     - `APP_BASE_URL` (e.g. `http://localhost:3000`)
     - `CRON_SECRET` (shared with Worker)

3) Run the web app
```bash
cd web
pnpm install
pnpm dev   # http://localhost:3000
```

4) Run the Worker
```bash
cd worker
pnpm install
pnpm dev   # http://127.0.0.1:8787
```

5) Configure Worker for real Best Buy data
   - In `worker/wrangler.toml` set:
     - `USE_REAL_BESTBUY = "1"`
     - `INGEST_URL = "http://localhost:3000/api/ingest"` (or your dev port)
     - Provide either `BESTBUY_SKUS` (comma list) or `BESTBUY_CATEGORY`
   - Secrets (in real deploys):
```bash
cd worker
wrangler secret put CRON_SHARED_SECRET   # value must equal web CRON_SECRET
wrangler secret put BESTBUY_API_KEY
```

6) Trigger ingest (Worker → Web)
```bash
curl -H "x-cron-secret: $CRON_SECRET" http://127.0.0.1:8787/cron
```

7) Browse
   - Search: http://localhost:3000/search
   - Home (Trending, Drops): http://localhost:3000/

## Quick Start (Dev)
1) Prereqs
- Node 20+, pnpm (or npm), Wrangler CLI
- A Postgres DB (Supabase works great)

2) Configure env
- Copy `.env.example` → `.env` and fill values.
- In `web/.env` set `DATABASE_URL`, `APP_BASE_URL`, `CRON_SECRET`, optional email creds.

3) Install and run web
```bash
cd web
pnpm install
pnpm dev  # Next runs on :3000 or :3001
```

4) Run Worker
```bash
cd worker
pnpm install
pnpm dev   # serves http://127.0.0.1:8787
```

5) Create/verify DB schema
- Prefer explicit SQL migrations via Supabase SQL editor or psql (see Migrations below).
- Add performance indexes from `db/sql/indexes.sql`.

6) Test flows
- Trigger Worker → Web ingest:
```bash
curl -H "x-cron-secret: <CRON_SECRET>" http://127.0.0.1:8787/cron
```
- Browse: http://localhost:3000/search (or :3001)

## Environment variables

Web (`web/.env`)
- `DATABASE_URL` — Postgres connection
- `APP_BASE_URL` — base URL used by the server (e.g. `http://localhost:3000`)
- `CRON_SECRET` — shared secret for `/api/ingest`
- Email (optional for magic links): `RESEND_API_KEY` or your provider
- UI: `NEXT_PUBLIC_BESTBUY_ATTRIB_DISABLED=1` hides Best Buy attribution

Worker (`worker/wrangler.toml` / secrets)
- `CRON_SHARED_SECRET` — must equal web `CRON_SECRET`
- `INGEST_URL` — e.g. `http://localhost:3000/api/ingest`
- `USE_REAL_BESTBUY` — `1` to pull real Best Buy
- `BESTBUY_API_KEY` — Worker secret
- Source selection: `BESTBUY_SKUS` or `BESTBUY_CATEGORY` (with `BESTBUY_PAGE_SIZE`)
- `USE_REAL_MICROCENTER` — optional, `1` to scrape DOM

## Data model (Drizzle)

`web/lib/drizzle/schema.ts`
- `inventory`: snapshots with `image_url`, `condition_rank`, `seen_at`
- `watches`: user watches; `verified` marks magic‑link confirmation (API tolerates DBs without this column but it’s recommended)
- `stores`, `users`, `magic_tokens`

Migrations added (SQL files under `web/lib/drizzle/migrations/`)
- `0020_bby_ttl.sql` — add `source`, `fetched_at`, `expires_at` + index on `expires_at`
- `0021_inventory_image_url.sql` — add `image_url`
- `0022_inventory_unique_snapshot.sql` — unique constraints for dedupe

Indexes (recommended)
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_inventory_title_trgm ON inventory USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_inventory_sku_trgm   ON inventory USING gin (sku gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_inventory_seen_at    ON inventory (seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_store      ON inventory (retailer, store_id);
```

## Ingestion pipeline

Web endpoint: `POST /api/ingest`
- Auth: `Authorization: Bearer <CRON_SECRET>` or header `x-cron-secret: <CRON_SECRET>`
- Payload: `{ items: Array<{ retailer, storeId, sku?, title, conditionLabel, priceCents, url, seenAt?, imageUrl? }> }`
- Behavior:
  - Normalizes condition → `condition_rank`
  - Inserts snapshots with `seen_at`
  - Dedupe:
    - Time-window skip for identical snapshots
    - Unique constraints on `(retailer,store_id,url,price_cents)` and `(retailer,store_id,sku,price_cents)` with `onConflictDoNothing()`

Worker sender
- `worker/src/scheduler.ts` batches items and POSTs to `INGEST_URL` with bearer `CRON_SHARED_SECRET`.
- Returns `{ ok, ingested, status }` or a JSON error on failure.

## Retailer adapters

Micro Center
- Real DOM scrape: `worker/src/adapters/microcenter_dom.ts` via `linkedom`
- Toggle with `USE_REAL_MICROCENTER=1` (else stub: `adapters/stubs.ts`)

Best Buy (official API)
- Worker adapter: `worker/src/adapters/bestbuy_api.ts`
  - Queries Open Box endpoints (beta) and maps `title`, `offers.prices.current`, `links.web`, `images.standard`
  - Returns `imageUrl` to render thumbnails
- Configure via `USE_REAL_BESTBUY=1`, `BESTBUY_API_KEY`, and either `BESTBUY_SKUS` or `BESTBUY_CATEGORY`

Web-side Best Buy (optional)
- Throttled client: `web/lib/retailers/bestbuy/client.ts` (p-throttle @ 5 rps)
- Adapter & ingest: `web/lib/retailers/bestbuy/adapter.ts`, `.../ingest.ts` with 71h TTL (`expires_at`)
- Triggered by `web/app/api/cron/route.ts` when `BESTBUY_ENABLED=1` and Best Buy watches exist

## Cron jobs

Worker cron
- `worker/src/index.ts` exposes `/cron` (requires `x-cron-secret`) and scheduled triggers via Wrangler.
- Scheduler (`worker/src/scheduler.ts`) picks Micro Center / Best Buy real adapters or stubs based on flags.

Web cron
- `web/app/api/cron/route.ts`
  - Purges expired Best Buy rows: `source='bestbuy' AND expires_at < now()`
  - Iterates watches and inserts dev items (placeholder)
  - If `BESTBUY_ENABLED=1`, ingests watched Best Buy SKUs via web-side adapter

## Search API & UI

Search API: `GET /api/inventory/search`
- Filters: `q`, `retailer`, `store_id` (repeat/comma), `sku`, `price_min/max` (USD), `min_condition`
- Pagination: cursor on `(seen_at, id)`
- Joins `stores` to enrich display fields
- Includes `image_url` in results

UI highlights
- Sticky desktop filters + mobile Drawer; Filter chips; Sort (Dropdown)
- Save search (opens Watch drawer)
- Infinite scroll + “Load more” fallback; skeletons
- Cards: thumbnails (Next/Image), inline price badge, compact badges, sparkline (under image)
- “Watch” opens a drawer; anonymous users can enter email to receive a magic link

## Deployment

Web (Vercel)
- Set env: `DATABASE_URL`, `CRON_SECRET`, optional email, Best Buy flags
- Optionally set `SUPABASE_CA_B64` for strict TLS

Worker (Cloudflare)
- `worker/wrangler.toml` — name, triggers, vars
- Set secrets via Wrangler:
```bash
cd worker
wrangler secret put CRON_SHARED_SECRET
wrangler secret put BESTBUY_API_KEY
```
- Set `INGEST_URL=https://<your-web-domain>/api/ingest`

## Runbook

Local dev
- Web: `cd web && pnpm dev`
- Worker: `cd worker && pnpm dev`
- Trigger: `curl -H "x-cron-secret: <CRON_SECRET>" http://127.0.0.1:8787/cron`
-- Inspect: `http://localhost:3000/api/inventory/search?limit=5`

Migrations
- This repo no longer ships `.sql` files. If your DB predates the `watches.verified` column, add it:
  ```sql
  ALTER TABLE public.watches ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false;
  ```
  The API tolerates missing `verified`, but enabling it provides the best UX for email‑first flow.

TLS & Drizzle CLI
- Preferred: set `SUPABASE_CA_B64` so CLI can verify TLS
- Dev fallback: `DRIZZLE_ALLOW_INSECURE=1` (and if needed `NODE_TLS_REJECT_UNAUTHORIZED=0`) for CLI-only operations

## Notes & limitations
- Best Buy Open Box API doesn’t expose store-level stock; items represent available open-box offers. Links expire after ~7 days; TTL is enforced (71h).
- ZIP/radius filtering is a placeholder; needs ZIP → lat/lng table and distance filtering.
- Alerts/auth are minimal; extend as needed.
