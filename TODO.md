

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

* [x] On `ItemCard`, add 👍 button; store `voter_hash` in cookie (uuid).
* [x] Sort option: “Most upvoted (24h)”.

**Acceptance**

* Voting increments and persists; sort respects window.

---

## 7) Pro tier scaffolding (no paywall yet)

* [ ] Add `users.plan` column (enum: `free|pro`) and a `max_watches` computed setting in web.

  * `web/lib/drizzle/migrations/0027_users_plan.sql`
* [x] Gate: free = 3 watches (env `FREE_WATCH_LIMIT`, API enforced). Pro tier not wired yet.
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


Absolutely—here’s a **copy-pasteable section** you can drop into `TODO.md` to incorporate the Best Buy (BB) store-level enrichment plan while keeping the rest of your roadmap intact. I’ve matched your file/dir naming and existing patterns from your README/TODO. ([GitHub][1])

---

# Best Buy Store-Level Enrichment (Pins + Local Alerts)

> Goal: keep using the BB Open Box offers feed for breadth, but **enrich specific SKUs on-demand** (ZIP-scoped) to resolve **store-level availability** for pins and precise alerts. Avoid bulk crawling; cache aggressively; prefer official APIs when sufficient.

## 0) Flags & env

* [x] **web/.env.example**

  ```
  # enrichment toggles
  BESTBUY_ENRICHMENT_ENABLED=1
  BESTBUY_ENRICHMENT_TTL_MIN=30
  BESTBUY_ENRICHMENT_FAIL_TTL_MIN=10
  BESTBUY_MAX_ENRICH_RPS=2

  # optional if sending mail from worker instead of web
  RESEND_API_KEY=
  ```
* [x] **worker/wrangler.toml**

  ```toml
  [vars]
  ENABLE_BB_ENRICHMENT = "1"
  BB_ENRICHMENT_TTL_MIN = "30"
  BB_ENRICHMENT_FAIL_TTL_MIN = "10"
  BB_MAX_ENRICH_RPS = "2"
  # CRON_SHARED_SECRET (secret)
  # BESTBUY_API_KEY (secret, for official BB APIs if used)
  # RESEND_API_KEY (secret, optional if worker sends emails)
  ```

## 1) DB schema

* [x] **Add enrichment cache table**
  `web/lib/drizzle/migrations/0028_bb_store_availability.sql`

  ```sql
  CREATE TABLE IF NOT EXISTS public.bb_store_availability (
    id bigserial PRIMARY KEY,
    sku text NOT NULL,
    zip text NOT NULL,
    stores jsonb NOT NULL, -- [{id,name,lat,lng,hasOpenBox:boolean}]
    refreshed_at timestamptz NOT NULL DEFAULT now(),
    failed boolean NOT NULL DEFAULT false
  );
  CREATE UNIQUE INDEX IF NOT EXISTS ux_bb_avail_sku_zip
    ON public.bb_store_availability (sku, zip);
  CREATE INDEX IF NOT EXISTS idx_bb_avail_refreshed
    ON public.bb_store_availability (refreshed_at DESC);
  ```

## 2) Worker enrichment module

* [x] **Adapter**: `worker/src/enrichers/bestbuy_store_availability.ts`

  * `export async function checkStoresForSKU({ sku, zip }: {sku:string; zip:string})`

    * **Strategy**:

      1. Try **official BB APIs** (Products/Stores/Availability) with `(sku, zip)` to get nearby stores. If open-box signal is included, set `hasOpenBox=true`.
      2. If official API lacks open-box granularity, **fallback** to the PDP “check store availability” XHR (same JSON used by BB frontend after ZIP is set). Parse minimal JSON → `[ { id, name, lat, lng, hasOpenBox } ]`.
    * **Rate-limit** by `BB_MAX_ENRICH_RPS`.
    * **Cache** success for `BB_ENRICHMENT_TTL_MIN` and failures for `BB_ENRICHMENT_FAIL_TTL_MIN`.
  * **Write-through cache** to `bb_store_availability` with upsert on `(sku, zip)`.

* [x] **Scheduler endpoints**: extend `worker/src/index.ts`

  * `POST /enrich/bb` (requires `x-cron-secret`) body: `{ sku, zip }` → triggers single enrichment; returns cached or fresh.
  * Add CRON task `@every 10m` (prod) that **re-enriches hot SKUs**: those with active watches in the last hour.

## 3) Web API surface

* [x] **Resolve endpoint**: `web/app/api/bestbuy/availability/route.ts`

  * `GET ?sku=...&zip=...`
  * Checks local DB cache (`bb_store_availability`); if stale **and** `BESTBUY_ENRICHMENT_ENABLED=1`, call worker `POST /enrich/bb` with `x-cron-secret`, then return the fresh doc.
  * Response:

    ```json
    {
      "sku": "1234567",
      "zip": "02139",
      "refreshed_at": "2025-09-20T13:37:00Z",
      "stores": [{ "id":"####", "name":"Best Buy Dedham", "lat":42.24, "lng":-71.17, "hasOpenBox": true }]
    }
    ```

## 4) Watch flow integration (local alerts)

* [ ] **Watches table already extended** (zip/radius/price ceiling). When a user **creates or edits** a watch with `sku` **and** `zip`:

  * [x] **Kick enrichment**: server-side call to `web/api/bestbuy/availability` to warm cache.
  * [ ] Store `zip` on the watch; if stores come back, keep them alongside watch (optional denorm).

* [ ] **Alert matcher** (worker): in `worker/src/alerts/matcher.ts`

  * If retailer is `bestbuy` and watch has `zip`:

    * Confirm an open-box offer exists **today** (your current BB ingest already ensures national availability).
    * Join with `bb_store_availability (sku, zip)`; if `stores[].hasOpenBox == true` for any store within radius, **emit a local alert** (“Available at <StoreName>”) and record in `alert_events`.

## 5) UI/UX changes

* [ ] **ItemCard** & **Search results**

  * For BB items:

    * [x] If no enrichment available for user ZIP → badge **“📦 Online only”**; no pin on map.
    * [x] If enrichment exists and not stale → show **“Local availability verified <x>m ago”**; enable pins.

* [ ] **Item Drawer** (`PriceHistoryChart` drawer or Item detail)

  * Add **“Check local availability”** action if user has ZIP set; hit `web/api/bestbuy/availability?sku=...`.
  * Show nearest stores with distance (reuse `milesBetween`) and `hasOpenBox` pills.

* [x] **Map**

  * Do **not** pin BB items unless enriched; pin only the returned stores with `hasOpenBox=true`.
  * Legend:

    * Solid pin = local verified.
    * Hollow pin = other retailers with store coords (as you already do).
    * No pin = online only.

## 6) Abuse prevention & consistency

* [ ] **Backoff** and **jitter** on enrichment failures; mark `failed=true` to avoid loops.
* [ ] **Per-(sku, zip)** lock to avoid stampede (in-process mutex or Redis later).
* [ ] **Audit log**: add structured logs for every enrichment attempt (source=bb\_enrichment, sku, zip, ms, ok/fail, cache\_hit).

## 7) Tests / manual checks

* [ ] Unit: parser for PDP availability JSON → `[stores]`.
* [ ] Unit: enrichment cache TTL behavior (fresh vs stale vs fail).
* [ ] E2E (dev):

  1. Create watch (`sku=…`, `zip=02139`, radius=25).
  2. Trigger `curl -H "x-cron-secret: $CRON_SECRET" http://127.0.0.1:8787/alerts`
  3. Expect **local** alert if any verified store in radius; otherwise fallback **online** alert.

## 8) README notes

* [ ] In **Notes & limitations**, add:

  * “Best Buy Open Box offers are national (‘online’) by default. **Store-level pins require on-demand enrichment** for specific `(SKU, ZIP)` pairs. When available, we show ‘Local availability verified <x>m ago’; otherwise items are labeled ‘Online only’ and **not** pinned on the map.”

---

### Dev snippets to wire fast

**Route (web): `web/app/api/bestbuy/availability/route.ts` (sketch)**

```ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/drizzle/db';
import { bbStoreAvailability } from '@/lib/drizzle/schema'; // add model
import { isStale } from '@/lib/time';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sku = searchParams.get('sku');
  const zip = searchParams.get('zip');
  if (!sku || !zip) return NextResponse.json({ error: 'sku & zip required' }, { status: 400 });

  const ttlMin = Number(process.env.BESTBUY_ENRICHMENT_TTL_MIN ?? 30);
  const row = await db.query.bbStoreAvailability.findFirst({ where: (t, { eq, and }) => and(eq(t.sku, sku), eq(t.zip, zip)) });

  const stale = !row || isStale(row.refreshed_at, ttlMin) || row.failed;
  if (stale && process.env.BESTBUY_ENRICHMENT_ENABLED === '1') {
    await fetch(process.env.WORKER_BASE_URL + '/enrich/bb', {
      method: 'POST',
      headers: { 'x-cron-secret': process.env.CRON_SECRET!, 'content-type': 'application/json' },
      body: JSON.stringify({ sku, zip }),
    }).catch(() => {});
  }

  const fresh = row ? {
    sku, zip, refreshed_at: row.refreshed_at, stores: row.stores
  } : { sku, zip, refreshed_at: null, stores: [] };

  return NextResponse.json(fresh);
}
```

**Worker (sketch call signature):**

```ts
// worker/src/enrichers/bestbuy_store_availability.ts
export async function checkStoresForSKU({ sku, zip }: { sku: string; zip: string }) {
  // 1) try official APIs with BESTBUY_API_KEY
  // 2) else fallback to PDP availability XHR (parse JSON)
  // 3) return { stores, failed:false }  or { stores:[], failed:true }
}
```

---

This slots neatly into your existing ingestion/search/watch/alerts flow, keeps UX honest (no fake pins), and unlocks **precise local alerts** where they matter most—without reworking your entire BB pipeline. If you want, I can also generate the exact Drizzle model updates for `bb_store_availability` and add the minimal React pieces for the “Check local availability” button in your Item drawer.

[1]: https://github.com/armanewy/openbox-radar/blob/main/README.md "openbox-radar/README.md at main · armanewy/openbox-radar · GitHub"
