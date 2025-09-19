# UI Refactor Status

This document tracks the current state of the UI refactor and what remains.

## Completed

- Search UX
  - Sticky desktop filters and mobile Drawer
  - Filter chips above results
  - Server-side sort: relevance (default), price ↑/↓, newest
  - Infinite scroll with IntersectionObserver + Load more fallback
  - Loading skeletons for search route
- Product Cards
  - Compact ItemCard with image, compact badges, last-seen, title, store, actions
  - Inline price badge (top-right of meta row)
  - Sparkline moved under thumbnail to free horizontal space
  - Next/Image for Best Buy image hosts (falls back to `<img>` for others)
- Watch Flow
  - Drawer with optimistic create
  - Anonymous email-first watch creation (pending) + magic-link verification
  - Verify endpoint flips `watches.verified=true` and redirects back
- Home (Marketing)
  - SearchHero with quick chips
  - Trending carousel of items
  - Loading skeleton for marketing route
  - Best Buy attribution when trending includes Best Buy
- Stores Browser
  - States → store list pages
  - Density toggle and map toggle placeholder
  - Inline "Watch this store" using drawer
- System/Styling
  - Tailwind tokens: brand color, shadows, radii, typography plugin
  - Sonner toaster
  - shadcn/ui primitives: Button, Input, Badge, Drawer
  - Lucide icons

## Remaining / Next

- Home polish
  - Optional: a second carousel (e.g., biggest price drops) — Added using historical deltas
- Search polish
  - Sort by discount % (requires MSRP/regular price) — UI gated to Best Buy only
  - "Save search" CTA — Added (uses WatchSheet with derived defaults)
- Cards
  - Badge sizes/visibility — Compacted badges; hide retailer badge on xs
  - Next/Image — Added remotePatterns for **.microcenter.com
- Motion & Accessibility
  - Added hover/tap micro-interactions (guarded by `useReducedMotion`)
- shadcn/ui coverage
  - Sort menu converted to `DropdownMenu`
- Analytics (lightweight)
  - Added `/api/analytics` endpoint + client `track()`
  - Instrumented: search submits, filter apply, watch created, outbound click
- Billing (outside UI scope but related)
  - Stripe customer keyed by email; Checkout + Portal linked from settings

## DB Migration Applied

- `0023_watches_verified.sql` — adds `watches.verified boolean` with index
