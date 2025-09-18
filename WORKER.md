# Cloudflare Worker

Schedules retailer fetches and ingests items into the web app.

## Overview
- Entry: `worker/src/index.ts`
  - `scheduled()` runs via Wrangler cron triggers.
  - `fetch()` exposes `GET /cron` for manual runs; requires `x-cron-secret`.
- Scheduler: `worker/src/scheduler.ts`
  - Builds batches from adapters.
  - Posts to web `INGEST_URL` with `Authorization: Bearer <CRON_SHARED_SECRET>`.
  - Returns a small JSON summary or error.
- Adapters:
  - Micro Center DOM: `worker/src/adapters/microcenter_dom.ts` (linkedom).
  - Best Buy API: `worker/src/adapters/bestbuy_api.ts` (official Open Box).
  - Stubs: `worker/src/adapters/stubs.ts` (dev/testing).

## Configuration
- File: `worker/wrangler.toml`
  - `name`, `main`, `compatibility_date`.
  - `[triggers].crons` (e.g., `*/10 * * * *`).
  - `[vars]` runtime flags:
    - `CRON_SHARED_SECRET` — must match web `CRON_SECRET`.
    - `INGEST_URL` — web endpoint, e.g. `http://localhost:3001/api/ingest` (dev) or production URL.
    - `USE_REAL_MICROCENTER` — `'1'` for real DOM, `'0'` for stub.
    - `USE_REAL_BESTBUY` — `'1'` for API, `'0'` for stub.
    - Best Buy inputs:
      - `BESTBUY_SKUS` — comma list, highest priority when set.
      - `BESTBUY_CATEGORY` — e.g., `abcat0502000` (Laptops).
      - `BESTBUY_PAGE_SIZE` — default `50` (we often use `30` in dev).
  - Secrets (use Wrangler):
    - `BESTBUY_API_KEY` — Best Buy developer API key.

Secrets commands:
```bash
cd worker
wrangler secret put CRON_SHARED_SECRET
wrangler secret put BESTBUY_API_KEY
```

Note: do not commit secrets to `wrangler.toml`.

## Dev Runbook
- Start dev server:
```bash
cd worker
pnpm install
pnpm dev    # serves at http://127.0.0.1:8787
```
- Trigger cron locally:
```bash
curl -H "x-cron-secret: <CRON_SHARED_SECRET>" http://127.0.0.1:8787/cron
```
- Point to web dev ingest:
  - Set `INGEST_URL=http://localhost:3001/api/ingest` (or `:3000`).

## Adapters
### Micro Center (DOM)
- File: `src/adapters/microcenter_dom.ts`
- Fetches store/category pages and extracts product cards using `linkedom`.
- Toggle with `USE_REAL_MICROCENTER='1'`.

### Best Buy (Official API)
- File: `src/adapters/bestbuy_api.ts`
- Queries Open Box endpoints and maps results:
  - Prices from `offers.prices.current`.
  - URL from `links.web`.
  - Title from `names.title`.
  - Image from `images.standard`.
- Toggle with `USE_REAL_BESTBUY='1'` and a valid `BESTBUY_API_KEY`.
- Inputs via `BESTBUY_SKUS` or `BESTBUY_CATEGORY`.

## Deploy
- Configure `wrangler.toml` vars for production:
  - `INGEST_URL=https://<your-web-domain>/api/ingest`.
  - `CRON_SHARED_SECRET` as a secret.
  - Best Buy key via secret.
- Deploy:
```bash
cd worker
pnpm deploy
```
- Manual run (workers.dev):
```bash
curl -H "x-cron-secret: <CRON_SHARED_SECRET>" \
  https://<name>.<subdomain>.workers.dev/cron
```

## Notes
- The scheduler wraps ingest in try/catch and surfaces JSON errors.
- Keep adapter fetches polite; consider retries and backoff.

