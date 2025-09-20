# Open‑Box Radar

Open‑Box Radar is a Next.js 14 app + Cloudflare Worker that collects open‑box deals, stores normalized snapshots in Postgres, and exposes fast search and browse. Best Buy uses the official Open Box API; Micro Center can be scraped via DOM. The UI is open to browse/search (no login). “Watch” and “Save search” use passwordless email (magic link).

## Repo layout
- `web/` — Next.js app (app router)
  - Drizzle ORM + Postgres (Supabase‑friendly)
  - API routes: `ingest`, `inventory/search`, `inventory/history`, `inventory/trending`, `watches`, `alerts/*`, `auth/*`, `analytics`, `deal-votes`, `bestbuy/enrichment`
  - UI: landing hero with Hot Now + Near You, search with sticky filters, Sort (Dropdown incl. Upvoted), Save search, infinite scroll, trending + drops, price history drawer
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
- Enrichment: `BESTBUY_ENRICHMENT_ENABLED`, `BESTBUY_ENRICHMENT_TTL_MIN`, `BESTBUY_ENRICHMENT_FAIL_TTL_MIN`, `BESTBUY_MAX_ENRICH_RPS`

Worker (`worker/wrangler.toml` / secrets)
- `CRON_SHARED_SECRET` — must equal web `CRON_SECRET`
- `INGEST_URL` — e.g. `http://localhost:3000/api/ingest`
- `USE_REAL_BESTBUY` — `1` to pull real Best Buy
- `BESTBUY_API_KEY` — Worker secret
- Source selection: `BESTBUY_SKUS` or `BESTBUY_CATEGORY` (with `BESTBUY_PAGE_SIZE`)
- `USE_REAL_MICROCENTER` — optional, `1` to scrape DOM
- `ENABLE_BB_ENRICHMENT`, `BB_ENRICHMENT_TTL_MIN`, `BB_ENRICHMENT_FAIL_TTL_MIN`, `BB_MAX_ENRICH_RPS`

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
- Returns `{ ok, ingested, status, flags, sources }` or a JSON error on failure.

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
- `worker/src/index.ts` exposes `/cron` (requires `x-cron-secret`) and scheduled triggers via Wrangler (every 5 min).
- Scheduler (`worker/src/scheduler.ts`) picks adapters based on flags; dev stubs are disabled by default (`ALLOW_DEV_STUBS=0`).

Web cron
- `web/app/api/cron/route.ts`
  - Purges expired Best Buy rows: `source='bestbuy' AND expires_at < now()`
  - DEV insert is gated behind `ENABLE_DEV_CRON=1` (off in prod)
  - If `BESTBUY_ENABLED=1`, ingests watched Best Buy SKUs via web-side adapter

## Search API & UI

Search API: `GET /api/inventory/search`
- Filters: `q`, `retailer`, `store_id` (repeat/comma), `sku`, `price_min/max` (USD), `min_condition`, `zip`, `radius_miles`
- Pagination: cursor on `(seen_at, id)`
- Joins `stores` to enrich display fields
- Includes `image_url` in results
- When `zip` and `radius_miles` are provided, results are filtered by distance from the ZIP centroid to store coordinates. Unknown store coordinates are excluded. Response items include `distance_miles`.
- Optional sort: `upvoted` (24h window) using `/api/deal-votes` counts.

UI highlights
- Landing: hero with value prop + Hot Now (radar sweep animation and drops list) + Near You (ZIP + radius; persisted in localStorage)
- Sticky desktop filters + mobile Drawer; Filter chips; Sort (Dropdown incl. Upvoted)
- Save search (opens Watch drawer)
- Infinite scroll + “Load more” fallback; live result count
- Cards: thumbnails (Next/Image), inline price badge, compact badges, sparkline (under image); click sparkline → price history drawer
- “Watch” opens a drawer; anonymous users can enter email to receive a magic link
- Map view (MVP): `/search/map` groups results by store with distance labels (Best Buy is online‑only → shows as `bby‑online`)

## Deployment

Web (Vercel)
- Set env: `DATABASE_URL`, `CRON_SECRET`, optional email, Best Buy flags
- Optionally set `SUPABASE_CA_B64` for strict TLS

Worker (Cloudflare)
- `worker/wrangler.toml` — name, triggers (every 5 min), vars
- Set secrets via Wrangler:
```bash
cd worker
wrangler secret put CRON_SHARED_SECRET
wrangler secret put BESTBUY_API_KEY
```
- Set `INGEST_URL=https://<your-web-domain>/api/ingest`

Store coordinates backfill
- Optional helper to fill `stores.lat/lng` from ZIP centroids (US):
```bash
cd web
pnpm backfill:coords
```
This uses the free Zippopotam.us API; ensure your DB contains `zipcode` values for stores.

## Runbook

Local dev
- Web: `cd web && pnpm dev`
- Worker: `cd worker && pnpm dev`
- Trigger: `curl -H "x-cron-secret: <CRON_SECRET>" http://127.0.0.1:8787/cron`
-- Inspect: `http://localhost:3000/api/inventory/search?limit=5`

Seed a couple of dev items
- Set `CRON_SECRET` in your env and run: `node scripts/seed_dev_items.js`

Migrations
- This repo no longer ships `.sql` files. Apply DDL manually if your DB is missing these structures:
  - Watches magic-link UX (legacy installs):
    ```sql
    ALTER TABLE public.watches ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false;
    ```
  - Geo radius support (store coordinates):
    ```sql
    ALTER TABLE public.stores
      ADD COLUMN IF NOT EXISTS lat double precision,
      ADD COLUMN IF NOT EXISTS lng double precision;
    CREATE INDEX IF NOT EXISTS idx_stores_lat_lng ON public.stores (lat, lng);
    ```
  - Price history (append-only):
    ```sql
    CREATE TABLE IF NOT EXISTS public.price_history (
      id bigserial PRIMARY KEY,
      retailer text NOT NULL,
      store_id text,
      sku text,
      url text,
      price_cents integer NOT NULL,
      seen_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_ph_compound ON public.price_history (retailer, store_id, COALESCE(sku, url), seen_at DESC);
    ```
  The history API prefers `price_history` when present; ingest appends to it.

TLS & Drizzle CLI
- Preferred: set `SUPABASE_CA_B64` so CLI can verify TLS
- Dev fallback: `DRIZZLE_ALLOW_INSECURE=1` (and if needed `NODE_TLS_REJECT_UNAUTHORIZED=0`) for CLI-only operations

## Notes & limitations
- Best Buy Open Box API doesn’t expose store-level stock; items represent available open-box offers. Links expire after ~7 days; TTL is enforced (71h).
- Geo filtering uses ZIP centroids and store coordinates when available; stores lacking coordinates are excluded when a radius filter is active. For best results, backfill `stores.lat/lng` (script provided).
- `/api/ingest` drops obvious dev/stub items in production (e.g., titles starting with “DEV”, example.com URLs, known stub storeIds) as a safeguard.
- Alerts/auth are minimal; extend as needed.

## Business logic & product behavior

This section describes the current user-facing logic.

- Browsing without login
  - Home (Trending + Drops), search, filters, sort, and outbound clicks are open to everyone.
  - Best Buy attribution is shown when relevant; outbound links open in a new tab.

- Watch & Save search
  - Watch drawer opens from a card; Save search opens the same drawer with filters prefilled.
  - Signed-in users create an active watch immediately.
  - Signed-out users add Email in the drawer; a pending watch is created and a magic link is sent. After using the link, session is established and watches flip to verified.

- Identity
  - Passwordless email via magic link; session JWT in `obr_session` cookie.
  - Magic link tokens are one-use and expire after 15 minutes; sends are throttled (60s per email).

- Search UX
  - Filters: `q`, `retailer`, `sku`, `min_condition`, `price_min/max` (USD), `zip`, `radius_miles`, `store_id` (comma/repeat).
  - Sort: Relevance (default), Price ↑/↓, Newest. “Discount %” is UI-gated to Best Buy and depends on MSRP availability.
  - Pagination: keyset `(seen_at, id)` with `cursor`. Infinite scroll + “Load more” fallback.
  - Accessibility: brand color for CTAs, visible focus rings, reduced motion respected.

- Trending & drops logic
  - Trending: latest inventory ordered by `seen_at DESC, id DESC`.
  - Drops: past 7d compare prev vs current price for `(retailer, store_id, COALESCE(sku, url))`, list positive drops.

- Cards (list tiles)
  - Thumbnail (Next/Image for Best Buy domains; `<img>` fallback for others).
  - Compact meta (time ago, retailer, condition) + price badge on the right.
  - Title and store line; actions: View (outbound), Watch (drawer), Share (clipboard).
  - Price sparkline under the thumbnail; click opens a full history drawer.

- Ingestion & freshness
  - Worker pulls Best Buy (optional Micro Center) and POSTs to `/api/ingest`.
  - Ingest dedupes snapshots by time window (`INGEST_DEDUPE_MIN` minutes) and unique keys; appends to `price_history` when present; Best Buy links may expire in ~7 days.

- Analytics (lightweight)
  - `/api/analytics` collects client events. Currently recorded: search submit, filters apply, watch create (pending/immediate), outbound click.

- Theming
  - Neutral UI with a single brand accent for primary CTAs; outline buttons for secondary actions.

## Roadmap ideas

- Full discount sorting backed by MSRP for all retailers
- Geo distance filtering (ZIP → lat/lng) for radius searches
- Robust alerting jobs (email/SMS/Discord) with an alerts ledger and per-user plan limits
- Stripe-based billing (free vs pro) tied to email identity
- Replace analytics stub with a provider (PostHog) or your own store
