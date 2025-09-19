

# TODO — Open-Box Radar: “stand-out” features

## 0) Prep / conventions

* [x] Create branch: `feat/geo-alerts-history-ui`
* [x] Add env placeholders in `web/.env.example` and `worker/wrangler.toml` as noted below.
* [ ] Enable pg\_trgm + confirm existing indexes (you already have them).

---

## 1) Geo distance filtering (ZIP + radius + store distance)

### Data & utils

* [x] **Add ZIP→lat/lng**: `web/lib/geo/zipdb.ts`

  * Accept a minimal embedded CSV (US only for now) or wire up to a table later.
  * Export: `lookupZip(zip: string): { lat: number; lng: number } | null`
* [x] **Haversine util**: `web/lib/geo/distance.ts`

  * `export function milesBetween(a:{lat:number,lng:number}, b:{lat:number,lng:number}): number`

### DB (stores need coords)

* [x] **Add columns** to `stores`:

  * Migration file: `web/lib/drizzle/migrations/0023_stores_lat_lng.sql`

    ```sql
    ALTER TABLE public.stores
      ADD COLUMN IF NOT EXISTS lat double precision,
      ADD COLUMN IF NOT EXISTS lng double precision;
    CREATE INDEX IF NOT EXISTS idx_stores_lat_lng ON public.stores (lat, lng);
    ```
* [x] Backfill (manual or script) for Micro Center + BB store coords (can be incremental).

### API

* [x] Extend search handler `web/app/api/inventory/search/route.ts`

  * New query params: `zip`, `radius_miles`
  * Flow: if both present → lookup ZIP → fetch candidate stores by retailer (or all) → compute distance in app layer → filter results post-query or join stores and filter by a rough bounding box (±radius/69 deg) then refine in Node.

### UI

* [x] Add ZIP & Radius inputs:

  * `web/app/search/_components/FilterDrawer.tsx` → add fields `zip`, `radius`
  * Display active chip in filter bar
* [x] Map view (MVP):

  * New route: `web/app/search/map/page.tsx`
  * Use `<MapboxGL/>` later; for now a simple leaf cluster component or even a list grouped by store distance.

**Acceptance**

* Search with `zip=02139&radius_miles=25` returns only nearby store items.
* “Store line” shows `(~12.3 mi)` next to store name.

---

## 2) Price history & “drops” with charts

### DB

* [x] New table `price_history`:

  * `web/lib/drizzle/migrations/0024_price_history.sql`

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
* [x] **Web ingest** (`web/app/api/ingest/route.ts`):

  * After dedupe/insert to `inventory`, also `INSERT` into `price_history` (always append).

### API

* [x] New endpoint: `GET /api/inventory/history`

  * `web/app/api/inventory/history/route.ts`
  * Params: `retailer`, `store_id`, `sku | url`, `limit`
  * Returns `{ points: Array<{ price_cents, seen_at }> }`

### UI

* [x] **ItemCard sparkline** already exists—augment:

  * Click → open Drawer with full **Price History** chart
  * New comp: `web/components/PriceHistoryChart.tsx` (fetches `/api/inventory/history`)
  * Use `<canvas>` with `chart.js` or a tiny SVG line (keep deps light)

**Acceptance**

* History drawer shows last N points with dates & min/max.

---

## 3) Alerts (email/Discord/SMS later) with “local first”

### DB

* [ ] Extend `watches`:

  * `web/lib/drizzle/migrations/0025_watches_alerts.sql`

    ```sql
    ALTER TABLE public.watches
      ADD COLUMN IF NOT EXISTS zip text,
      ADD COLUMN IF NOT EXISTS radius_miles int,
      ADD COLUMN IF NOT EXISTS price_ceiling_cents int,
      ADD COLUMN IF NOT EXISTS retailer text,
      ADD COLUMN IF NOT EXISTS sku text,
      ADD COLUMN IF NOT EXISTS store_id text,
      ADD COLUMN IF NOT EXISTS channel_email boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS channel_discord boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS channel_sms boolean NOT NULL DEFAULT false;
    CREATE TABLE IF NOT EXISTS public.alert_events (
      id bigserial PRIMARY KEY,
      watch_id bigint REFERENCES public.watches(id) ON DELETE CASCADE,
      inventory_id bigint REFERENCES public.inventory(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_alert_events_watch ON public.alert_events (watch_id, created_at DESC);
    ```

### Worker

* [x] **Matcher**: `worker/src/alerts/matcher.ts`

  * Load all `watches` (paged)
  * For each, query recent inventory snapshots that satisfy:

    * price ≤ ceiling (if set)
    * within zip/radius (use same distance util; consider prefetch stores within radius)
    * retailer/sku/store filters if provided
  * Deduplicate by `(watch_id, inventory_id)` via `alert_events` insert-on-conflict
  * Return list of `{ watchId, email, matches[] }`

* [x] **Sender**: `worker/src/alerts/sender.ts`

  * For now email only (Resend key you already support)—batch per watch
  * Env: `RESEND_API_KEY` (already in web; mirror in worker or call a web endpoint to send)

* [x] **Scheduler**: `worker/src/index.ts`

  * Add `/alerts` route requiring `x-cron-secret`
  * CRON trigger every 5–10 min in prod

### Web (Watch Drawer)

* [ ] Extend watch form (existing):

  * Add fields: ZIP, Radius, Price ceiling, Channel toggles
  * File: `web/app/search/_components/WatchDrawer.tsx`

**Acceptance**

* Creating a watch with `zip/radius` and `price ceiling` yields a test email when cron runs (trigger via curl).

---

## 4) “Radar” landing revamp (identity + clarity)

### Landing page

* [x] Replace clutter with 3 blocks:

  * Big search bar
  * **“Hot Now”** (Top drops past 24h) → query `/api/inventory/trending?window=24h&sort=drop_pct`
  * **“Near You”** (if user provides ZIP once, store in localStorage)
* [x] Files:

  * `web/app/(marketing)/page.tsx` → simplify to hero + two sections
  * New comp: `web/components/RadarSweep.tsx` (simple CSS animation with pulsing “blips” from top 10 drops)

**Acceptance**

* Lighthouse > 90; no infinite scroll on landing; obvious value prop subtitle:

  * “Real-time open-box deals with local alerts & price history.”

---

## 5) Retailer adapter interface + add one new source (scaffold)

### Worker

* [x] Introduce common interface: `worker/src/adapters/types.ts`

  ```ts
  export type NormalizedItem = {
    retailer: 'bestbuy'|'microcenter'|'newegg'|'…';
    storeId?: string;
    sku?: string;
    title: string;
    conditionLabel?: string;
    priceCents: number;
    url: string;
    seenAt?: string;
    imageUrl?: string;
  };
  export interface RetailerAdapter {
    name: string;
    fetchBatch(opts: Record<string, any>): Promise<NormalizedItem[]>;
  }
  ```
* [ ] Refactor BB + MC adapters to implement it.
* [x] Add **Newegg clearance scaffold**:

  * `worker/src/adapters/newegg_clearance.ts` (DOM scrape stub returning empty in dev)
  * Flag: `USE_REAL_NEWEGG`
* [x] Update scheduler `worker/src/scheduler.ts` to loop adapters by flags.

**Acceptance**

* With `USE_REAL_NEWEGG=0`, pipeline still runs.
* Logging shows adapter registry and batch counts.

---

## 6) Community & trust (MVP)

### DB

* [ ] Tiny table for “helpful” votes on listings:

  * `web/lib/drizzle/migrations/0026_deal_votes.sql`

    ```sql
    CREATE TABLE IF NOT EXISTS public.deal_votes (
      id bigserial PRIMARY KEY,
      inventory_id bigint NOT NULL REFERENCES public.inventory(id) ON DELETE CASCADE,
      voter_hash text NOT NULL, -- hash of email or anon cookie to prevent abuse
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (inventory_id, voter_hash)
    );
    ```

### UI

* [ ] On `ItemCard`, add 👍 button; store `voter_hash` in cookie (uuid).
* [ ] Sort option: “Most upvoted (24h)”.

**Acceptance**

* Voting increments and persists; sort respects window.

---

## 7) Pro tier scaffolding (no paywall yet)

* [ ] Add `users.plan` column (enum: `free|pro`) and a `max_watches` computed setting in web.

  * `web/lib/drizzle/migrations/0027_users_plan.sql`
* [ ] Gate: free = 3 watches, pro = 50 (just enforce in API; UI shows hint).
* [x] Add placeholders for Stripe keys in `web/.env.example` for later.

**Acceptance**

* Creating >3 watches as anon → prompt sign-in; as free → show “upgrade” tooltip (no payment yet).

---

## 8) Observability & guardrails

* [x] Add **structured logs** in worker (`/alerts`, `/cron`) with counts & latency.
* [x] Add **/api/health** in web returning DB, migrations, and last-cron times.

  * `web/app/api/health/route.ts`

---

## 9) ENV & config checklist

**web/.env.example**

```
# existing…
NEXT_PUBLIC_MAPBOX_TOKEN=           # for map later
ALERTS_FROM_EMAIL=noreply@openboxradar.com
RESEND_API_KEY=                     # already supported
```

**worker/wrangler.toml**

```toml
[vars]
USE_REAL_BESTBUY = "1"
USE_REAL_MICROCENTER = "1"
USE_REAL_NEWEGG = "0"
INGEST_URL = "https://<web>/api/ingest"

# alerts
ENABLE_ALERTS = "1"
ALERTS_BATCH_SIZE = "500"

# keys (put via wrangler secret)
# CRON_SHARED_SECRET
# BESTBUY_API_KEY
# RESEND_API_KEY   # if sending from worker
```

---

## 10) Quick test script & runbook

* [ ] Seed a couple fake items near a known ZIP:

  * `scripts/seed_dev_items.ts` (POST to `/api/ingest` with x-cron-secret)
* [ ] Trigger:

  ```
  curl -H "x-cron-secret: $CRON_SECRET" http://127.0.0.1:8787/cron
  curl -H "x-cron-secret: $CRON_SECRET" http://127.0.0.1:8787/alerts
  ```
* [ ] Verify:

  * Search with `zip`/`radius` returns expected items
  * History drawer renders
  * Watch → email sent on match

---

## 11) Definition of Done (D.O.D.)

* Geo filter works end-to-end, with store distance labels.
* Price history chart drawer available on any card with ≥2 points.
* Alerts scheduler sends real emails for ZIP/radius/price ceiling watches; de-dupes via `alert_events`.
* Landing page is clean (hero + two sections + radar sweep).
* Adapter interface in place; adding a retailer is 1 file + flag.
* Voting works; “Most upvoted (24h)” sort available.
* Free vs Pro watch limits enforced (no payments yet).
* `/api/health` shows green, CRON runs visible in logs.
