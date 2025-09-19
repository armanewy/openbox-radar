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
  - "How it works" 3-step row + trust line under the hero
  - Optional: a second carousel (e.g., biggest price drops) when MSRP available
- Search polish
  - Sort by discount % (requires MSRP/regular price)
  - "Save search" CTA that creates a watch for current filters
- Cards
  - Finalize badge sizes/visibility on xs; optionally hide retailer badge on very narrow cards
  - Extend Next/Image remote patterns for Micro Center image hosts
- Motion & Accessibility
  - Framer Motion micro-interactions with `useReducedMotion` guard
- shadcn/ui coverage
  - Convert Sort menu to `DropdownMenu`; add Dialogs where helpful (share/details)
- Analytics (lightweight)
  - Track search submits, filter toggles, watch created, outbound retailer clicks
- Billing (outside UI scope but related)
  - Stripe customer keyed by email; Checkout + Portal linked from settings

## DB Migration Applied

- `0023_watches_verified.sql` — adds `watches.verified boolean` with index

