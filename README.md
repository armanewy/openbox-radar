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

## Deploy outline

- **Domain**: buy at Cloudflare or Namecheap; set Cloudflare for DNS.
- **Web**: deploy `web/` to Vercel; add your domain; set env vars.
- **DB**: Supabase Postgres; set `DATABASE_URL` in Vercel/Worker.
- **Email**: Postmark or Resend key in env.
- **Worker**: `wrangler deploy` + Cron Triggers (15/60 min) in `wrangler.toml`.

---

### Notes

- Retailer adapters are stubs—fill selectors as you implement.
- Magic-link auth is stubbed; you can swap in Supabase Auth easily.
- Keep polling polite; honor robots and add jitter/backoff.
