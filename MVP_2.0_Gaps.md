# MVP 2.0 — Remaining Work

This file tracks what’s not yet implemented from the MVP 2.0 plan and the concrete tasks to close gaps.

## 1) Geo Search + “Near You”
- [ ] Data: ensure `stores` has `lat`/`lng` populated; backfill from a known source (CSV per retailer or ZIP geocoding).
- [ ] Data: add a `zipcodes` table (ZIP → lat,lng) for distance calculations.
- [ ] API: `GET /api/inventory/search` — when `zip` and `radius_miles` are provided, compute distance (Haversine) using store lat/lng and filter; include optional `distance_miles` in response.
- [ ] API: `GET /api/stores/near?zip=...&radius=...` to return nearby stores across retailers (for wizards and home page).
- [ ] UI: home page “Latest near you” module — prompt for ZIP and show recent items within radius.

Acceptance
- Provide `zip` + `radius_miles` and receive filtered results with p95 < 400ms on 10k rows.
- Home module renders a list when a ZIP is provided.

## 2) Item Detail + History
- [ ] Route: `/item/[retailer]/[key]` where key is `store_id+sku` (if present) else a hash of `url`.
- [ ] Query: pull latest snapshot and recent history for that key, ordered by `seen_at DESC`.
- [ ] UI: detail page with title, current price, condition, store, “last seen”, link to retailer, and recent price history list (or tiny chart later).
- [ ] CTA: “Watch this.”

Acceptance
- Opening a detail URL shows the current snapshot and last 10 snapshots for that item key.

## 3) Trending — Most Watched
- [ ] API: extend `GET /api/inventory/trending` with `type=watched` to return top watched items (aggregate `watches` by `(retailer, coalesce(sku, product_url))`).
- [ ] UI: add “Most watched” section on home with links to browse or detail pages.

Acceptance
- `type=watched` returns at least 5 items with counts; home displays the list.

## 4) Analytics (Minimal)
- [ ] DB: `events` table — `id, user_id?, type text, payload jsonb, created_at timestamptz default now()`.
- [ ] API: `POST /api/events` (internal) to log events.
- [ ] Client: fire events for search submit, filter changes, outbound retailer click, and watch creation.

Acceptance
- Events insert without affecting user flows; basic counts visible via SQL.

## 5) Materialized “Latest” View (Optional Optimization)
- [ ] SQL: create `inventory_latest` as DISTINCT ON (retailer, store_id, coalesce(sku, url)) ordered by `seen_at DESC`.
- [ ] Index: unique on the MV key and `seen_at DESC`.
- [ ] Cron: refresh the MV periodically (optionally CONCURRENTLY).
- [ ] API: switch `/api/inventory/search` to read from MV by default; provide a flag to include full history if needed.

Acceptance
- Search reads from MV and returns identical results to the pre‑MV path for typical queries.

## 6) Alerts Ledger
- [ ] DB: `alerts_sent(user_id uuid, retailer text, store_id text, key text, price_cents int, sent_at timestamptz)`.
- [ ] Logic: before sending an email, skip if an identical alert exists within N hours; insert a row after sending.

Acceptance
- Repeated cron runs do not re‑send identical alerts within the dedupe window.

## 7) Additional Nice‑to‑Haves
- [ ] Outbound click telemetry (transparent; preserve direct retailer URL, use beacon or a simple redirect with clear `rel=nofollow`).
- [ ] Condition mapping polish for Best Buy (beyond excellent/certified).
- [ ] Basic tests for adapters and API routes.

## 8) Notes / Constraints
- Best Buy Open Box API doesn’t expose per‑store stock; items represent available offers. Store‑level targeting is not possible via the official API.
- Continue to avoid `drizzle:push` on existing DBs with custom types; prefer explicit SQL migrations.

