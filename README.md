# Open-Box Radar

Next.js web app + Cloudflare Worker that collects open-box deals, normalizes them into Postgres, and exposes search + browse. Micro Center is scraped via DOM; Best Buy uses the official Open Box API. Freshness is enforced via TTL; ingestion is deduped.

## Repo Layout
- `web/` — Next.js 14 app
  - Drizzle ORM + Postgres (Supabase)
  - API routes: ingest, search, cron, health, auth stubs
  - UI: search page with thumbnails, attribution
- `worker/` — Cloudflare Worker
  - Cron scheduler, retailer adapters (Micro Center DOM, Best Buy API, stubs)
- `db/` — SQL indexes and notes
- `.env.example` — env var checklist

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

## Environment Variables

Web (Vercel / local `.env`)
- `DATABASE_URL` — Postgres connection
- `APP_BASE_URL` — e.g. `http://localhost:3000`
- `CRON_SECRET` — shared secret for ingest/cron
- Best Buy (optional web-side ingest):
  - `BESTBUY_ENABLED=1`
  - `BESTBUY_API_KEY=<key>`
  - `BESTBUY_RENDER_ENABLED=1` (optional toggle to hide/show BB cards)
  - `NEXT_PUBLIC_BESTBUY_ATTRIB_DISABLED=1` hides attribution
- TLS for Drizzle CLI (optional):
  - `SUPABASE_CA_B64` (preferred) or set `DRIZZLE_ALLOW_INSECURE=1` for local CLI

Worker (Wrangler / secrets)
- `CRON_SHARED_SECRET` — must match web `CRON_SECRET`
- `INGEST_URL` — dev: `http://localhost:3001/api/ingest` (or :3000)
- `USE_REAL_MICROCENTER` — `1` to scrape, `0` for stub
- `USE_REAL_BESTBUY` — `1` to use API, `0` for stub
- Best Buy inputs (for Worker run):
  - `BESTBUY_API_KEY` (Wrangler secret)
  - `BESTBUY_SKUS` (comma list) or `BESTBUY_CATEGORY` (e.g., `abcat0502000`), `BESTBUY_PAGE_SIZE`

## Data Model (Drizzle)

`web/lib/drizzle/schema.ts`
- `inventory`
  - `id serial PK`
  - `retailer retailer_t`, `store_id text`, `sku text`
  - `title text`, `condition_label text`, `condition_rank cond_rank_t`
  - `price_cents int`, `url text`, `image_url text`
  - `seen_at timestamptz`
  - `source text`, `fetched_at timestamptz`, `expires_at timestamptz`
- `watches`: user watches (retailer, sku/keywords, geo prefs)
- `stores`: store metadata (name/city/state/zip)
- `users`, `magic_tokens`: minimal email auth

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

## Ingestion Pipeline

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

## Retailer Adapters

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

## Cron Jobs

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

UI: `web/app/search/page.tsx`
- Filter sidebar and results list with condition/price/store
- Thumbnails from `image_url`
- “View at Retailer” uses direct retailer URLs (nofollow + noopener)
- Best Buy attribution: `web/components/BestBuyAttribution.tsx` (shown when results include Best Buy items)

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
- Inspect: `http://localhost:3000/api/inventory/search?limit=5`

Migrations
- Apply SQL in `web/lib/drizzle/migrations/*.sql` via Supabase SQL editor or:
```bash
psql "$DATABASE_URL" -f web/lib/drizzle/migrations/0020_bby_ttl.sql
psql "$DATABASE_URL" -f web/lib/drizzle/migrations/0021_inventory_image_url.sql
psql "$DATABASE_URL" -f web/lib/drizzle/migrations/0022_inventory_unique_snapshot.sql
```
- Note: avoid `drizzle:push` on existing DBs with custom types — use SQL migrations instead.

TLS & Drizzle CLI
- Preferred: set `SUPABASE_CA_B64` so CLI can verify TLS
- Dev fallback: `DRIZZLE_ALLOW_INSECURE=1` (and if needed `NODE_TLS_REJECT_UNAUTHORIZED=0`) for CLI-only operations

## Notes & Limitations
- Best Buy Open Box API doesn’t expose store-level stock; items represent available open-box offers. Links expire after ~7 days; TTL is enforced (71h).
- ZIP/radius filtering is a placeholder; needs ZIP → lat/lng table and distance filtering.
- Alerts/auth are minimal; extend as needed.
