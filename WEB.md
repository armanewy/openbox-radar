# Web App (Next.js)

Next.js 14 app that stores inventory, exposes APIs for ingest/search/cron, and renders a search UI.

## Overview
- Framework: Next.js 14 (App Router)
- DB: Postgres (Supabase) via Drizzle ORM
- APIs:
  - `POST /api/ingest` — batch insert inventory snapshots (with dedupe)
  - `GET /api/inventory/search` — filtered, paginated search
  - `GET /api/cron` — maintenance + optional Best Buy ingest
  - `GET /api/health` — diagnostics
- UI:
  - `app/search/page.tsx` — filters, list, thumbnails, attribution

## Environment
- `DATABASE_URL` — Postgres connection string
- `APP_BASE_URL` — e.g. `http://localhost:3000`
- `CRON_SECRET` — bearer for `/api/ingest` and prod `/api/cron`
- Best Buy (optional web-side ingest):
  - `BESTBUY_ENABLED=1` to ingest watched SKUs
  - `BESTBUY_API_KEY=<key>`
  - `BESTBUY_RENDER_ENABLED=1` to allow rendering BBY items (optional)
  - `NEXT_PUBLIC_BESTBUY_ATTRIB_DISABLED=1` to hide attribution (optional)
- TLS for Drizzle CLI (optional):
  - `SUPABASE_CA_B64` base64 CA (preferred)
  - `DRIZZLE_ALLOW_INSECURE=1` for local CLI fallback

## Dev Commands
```bash
cd web
pnpm install
pnpm dev                 # Next on :3000 or :3001
pnpm drizzle:push        # avoid on custom-type DBs; prefer SQL
pnpm build && pnpm start # production
```

## Database
Schema: `lib/drizzle/schema.ts`
- `inventory`
  - identity: `id serial`
  - identity keys: `retailer`, `store_id`, `sku`, `url`
  - details: `title`, `condition_label`, `condition_rank`, `price_cents`, `image_url`
  - timing: `seen_at`, `fetched_at`, `expires_at`
  - source: `source` (e.g., `bestbuy`, `microcenter`)
- `watches` — user watches
- `stores` — store metadata
- `users`, `magic_tokens` — auth stubs

Migrations: `lib/drizzle/migrations/*.sql`
- `0020_bby_ttl.sql` — TTL fields + index
- `0021_inventory_image_url.sql` — image URL
- `0022_inventory_unique_snapshot.sql` — unique dedupe constraints

Indexes (recommended; in `db/sql/indexes.sql`)
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_inventory_title_trgm ON inventory USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_inventory_sku_trgm   ON inventory USING gin (sku gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_inventory_seen_at    ON inventory (seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_store      ON inventory (retailer, store_id);
```

## APIs
### POST /api/ingest
- Auth: `Authorization: Bearer <CRON_SECRET>` or header `x-cron-secret`
- Body: `{ items: [{ retailer, storeId, sku?, title, conditionLabel, priceCents, url, seenAt?, imageUrl? }] }`
- Behavior:
  - Validates with zod, maps condition label → rank
  - Inserts snapshots with `seen_at`
  - Dedupe: time-window skip + `onConflictDoNothing()` with unique constraints

### GET /api/inventory/search
- Query params: `q`, `retailer`, `store_id`, `sku`, `price_min/max` (USD), `min_condition`, `limit`, `cursor`
- Returns list + `nextCursor`
- Joins `stores` to enrich display
- Includes `image_url`

### GET /api/cron
- In dev: always callable
- In prod: requires `Authorization: Bearer <CRON_SECRET>`
- Actions:
  - Purge expired Best Buy rows: `source='bestbuy' AND expires_at < now()`
  - Iterate watches and insert dev items (placeholder)
  - If `BESTBUY_ENABLED=1`, ingest watched Best Buy SKUs using web-side adapter

### GET /api/health
- Basic diagnostics for DB/FS/env

## UI
- `app/search/page.tsx` renders list with pricing, condition, store, and thumbnail (`image_url`).
- “View at Retailer” links go directly to retailer (nofollow + noopener).
- Best Buy attribution component: `components/BestBuyAttribution.tsx`.

## Best Buy (Web-side)
- Throttled client: `lib/retailers/bestbuy/client.ts` (p-throttle @ 5 rps)
- Adapter: `lib/retailers/bestbuy/adapter.ts` (centralize query/mapping)
- Ingest: `lib/retailers/bestbuy/ingest.ts` (71h TTL)
- Controlled by `BESTBUY_ENABLED=1`

## Deployment
- Vercel project for `/web`.
- Set env vars: `DATABASE_URL`, `CRON_SECRET`, Best Buy flags as needed.
- Optional: `SUPABASE_CA_B64` for strict TLS.

## Troubleshooting
- “column does not exist” after migration: confirm you applied the SQL in Supabase and the app connects to the same DB.
- Drizzle CLI SSL errors: set `SUPABASE_CA_B64` or use `DRIZZLE_ALLOW_INSECURE=1`; avoid `drizzle:push` on existing DBs with custom types.
- Empty results: check worker logs or call `/api/cron` to produce dev items.

