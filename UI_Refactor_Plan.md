# Design direction (site-wide)

**Look & feel**

* Modern, high-contrast neutral UI with a **single accent** (e.g., “radar green”). Prefer clean cards, rounded-xl corners, soft shadows, subtle glass overlay for filter bars.
* Typography: Inter/Geist; tighten line-height; increase base size to `16/17px`, headings bolder.
* Motion: micro-interactions (hover/press, toast, optimistic state), **respect reduced motion**. ([Motion][1])

**Tech**

* Add **shadcn/ui** (Dialog/Drawer/Sheet/Dropdown/Tabs) + **Sonner** for toasts.
* Add **Framer Motion (Motion/Framer)** for tiny animations with `useReducedMotion` guard.
* Use **Next/Image** everywhere (images you already get from Best Buy).

---

# Home (web/app/(marketing)/page.tsx)

### What to change

1. **Hero search**: larger input with retailer & condition chips inline, example placeholders (“Search by SKU, product, or keywords”).
2. **Trending modules**: split into horizontal carousels with image-forward cards (“Recent open-box”, “Biggest price drops”).
3. **How it works** row (3 steps, compact) + trust line (“Free alerts. We link you directly to the retailer.”).

### Why

* Users rely on **prominent search** and guided suggestions; autosuggest + facets improve success. ([Nielsen Norman Group][2])
* **Visual product lists** with clear thumbnails and scannable meta outperform sparse lists. ([Baymard Institute][3])

### How (feasible steps)

* Add `components/SearchHero.tsx` (input + quick chips).
* Add `components/Carousel.tsx` (horizontal scroll + snap).
* Add `app/(marketing)/loading.tsx` with **skeletons** for the carousels (not spinners). ([Nielsen Norman Group][4])

---

# Search (web/app/search/page.tsx + /api/inventory/search/route.ts)

### What to change

1. **Sticky filter rail on desktop**; **Drawer on mobile**. Selected filters render as **chips** above the results.
2. **Sort dropdown** with essentials: **Relevance, Price ↑/↓, Newest, Discount %**. Avoid exotic sorts. ([Baymard Institute][5])
3. **Result density & card design** (see “Card” below).
4. **Infinite scroll** (IntersectionObserver) with optional “View more” button to avoid dead ends.
5. **Asynchronous “Watch this”** (no navigation): click → inline state change, toast, optimistic add.

### Why

* **Faceted search** (clear categories/values) + good defaults improves findability and conversion. ([Nielsen Norman Group][6])
* **Sort basics** cover 80%+ use cases, extra sorts hurt more than help. ([Baymard Institute][5])
* Perceived performance is better with **skeletons** and progressive rendering than spinners. ([Nielsen Norman Group][4])

### How

* Use **shadcn** `Drawer` for mobile filters; `Dialog` on desktop if you prefer modal. ([Shadcn UI][7])
* Add `useOptimistic` / `useTransition` (or **TanStack Query**) for **optimistic Watch** creation via `/api/watches`.
* Add `components/FilterChips.tsx` + `components/SortMenu.tsx`.
* Add `app/search/loading.tsx` skeleton grid.
* Add `components/InfiniteList.tsx` (IOObserver) + fallback “Load more”.

---

# Product card system (shared)

### What to change

* **Image** (from Best Buy, fallback retailer logo).
* **Title** (2-line clamp), **retailer chip**, **condition badge**, **price** + “vs MSRP” or **% off** when known.
* **Store badge** (city or distance when “near you” is live).
* **Last seen x ago** (already present—style as a subtle badge).
* **Actions**: “View at Retailer” (primary), “Watch” (icon button, optimistic), “Share” (copy link).
* Small **sparkline** (last 7 entries) when history exists.

### Why

* Baymard shows **clear thumbnails**, concise titles, key specs, and clear CTAs outperform. ([Baymard Institute][3])

### How

* Create `components/cards/ItemCard.tsx` with prop `source='bestbuy'|'microcenter'`.
* Use **Recharts** for sparkline (lazy-load).
* Add subtle **elevate on hover** + **tap feedback** (Motion). Respect reduced motion. ([Motion][1])

---

# “Add Watch” flow (keep user on page)

### What to change

* Convert the current wizard into a **responsive Drawer/Dialog** that can be launched from:

  * Search results card (“Watch”),
  * Search page toolbar (“Save this search”),
  * Store pages (“Watch this store/SKU”).
* One lightweight step: prefill from context (SKU, retailer, location) → **Create** → **Toast** → stay on page.

### Why

* Avoid context switching; in-place actions increase completion. (General UX + Baymard list flows.) ([Baymard Institute][8])

### How

* `components/watch/WatchSheet.tsx` (shadcn Drawer).
* Hook to `/api/watches` with **optimistic update** + **Sonner toast**. ([Shadcn UI][9])

---

# Stores browser (web/app/stores/…)

### What to change

* Grid of states → store list with **density controls** (compact/comfortable) and a **Map** toggle (MapLibre/Leaflet later).
* Each store row has a **Browse inventory** CTA and **Watch this store** inline.

### Why

* Geospatial context helps discovery; faceted lists still need scannability. ([Nielsen Norman Group][6])

### How

* `components/stores/StoreRow.tsx` with inline watch.
* Defer Map until geo is ready; keep a placeholder toggle (no blockers).

---

# Empty/loading/edge states

### What to add

* **Empty search** → friendly copy + example queries + quick links to “Trending” and “Browse Stores”.
* **Zero results** → suggest relaxing filters; chip to **Clear all**.
* **Loading** → skeletons tailored to card layout; avoid global spinners. ([Nielsen Norman Group][4])

---

# Aesthetics & systemization

### Tailwind tokens

* Update `tailwind.config` with design tokens:

  * `colors.brand = { DEFAULT: '#00e676', 600:'#00c26a', … }`
  * `radius: { xl: '1rem', '2xl': '1.25rem' }`
  * `shadow-card` (soft lg)
* Add `prose` styles for docs/help pages.

### Iconography

* **lucide-react** for consistent icons (watch/heart, filter, sort, sparkline, external).

### Micro-interactions

* **Card hover** (1–2px translateY, shadow lift),
* **Button press** (scale 0.98),
* **Toast** on success/failure,
* Respect **prefers-reduced-motion** globally. ([Motion][1])

---

# Analytics & feedback (lightweight)

* Track: search submits, filter toggles, watch created, outbound click to retailer.
* Heatmap or event tool (e.g., PostHog) later; keep an internal log for now.

---

# Quick file/task checklist

**Add libs**

* `pnpm add framer-motion sonner class-variance-authority lucide-react`
* (If you want shadcn/ui:) `pnpm dlx shadcn-ui@latest init` then add `drawer`, `dialog`, `dropdown-menu`, `button`, `input`, `badge`.

**Components**

* `components/SearchHero.tsx`
* `components/Carousel.tsx`
* `components/cards/ItemCard.tsx` (+ sparkline w/ lazy Recharts)
* `components/FilterChips.tsx`, `components/SortMenu.tsx`
* `components/InfiniteList.tsx`
* `components/watch/WatchSheet.tsx`
* `components/ui/Toaster.tsx` (Sonner)
* `components/BestBuyAttribution.tsx` (if showing BB data on a page)

**Routes**

* `app/(marketing)/loading.tsx` (skeletons)
* `app/search/loading.tsx` (skeleton grid)

**Hooks**

* `useOptimisticWatch.ts` (wrap POST `/api/watches` with optimistic updates + toast)

**Styling**

* Tailwind tokens, shadows, rounded, `container mx-auto max-w-7xl` layout constraints.

---

# Prioritized wins (1–2 days of polish)

1. **Asynchronous Watch Drawer** + optimistic/Toast (no navigation).
2. **Card redesign** with images/badges and hover micro-interactions.
3. **Sticky filters + mobile Drawer**; filter chips + basic sorts.
4. **Skeleton loaders** for search & home carousels. ([Nielsen Norman Group][4])
5. **Trending carousels** with images on the home page.


[1]: https://motion.dev/docs/react-accessibility?utm_source=chatgpt.com "Create accessible animations in React — Guide - Motion"
[2]: https://www.nngroup.com/articles/state-ecommerce-search/?utm_source=chatgpt.com "The State of Ecommerce Search"
[3]: https://baymard.com/blog/current-state-product-list-and-filtering?utm_source=chatgpt.com "Product List UX Best Practices 2025"
[4]: https://www.nngroup.com/articles/skeleton-screens/?utm_source=chatgpt.com "Skeleton Screens 101"
[5]: https://baymard.com/blog/essential-sort-types?utm_source=chatgpt.com "4 Essential Sort Types – Baymard Institute"
[6]: https://www.nngroup.com/articles/mobile-faceted-search/?utm_source=chatgpt.com "Mobile Faceted Search with a Tray : New and Improved ..."
[7]: https://ui.shadcn.com/docs/components/drawer?utm_source=chatgpt.com "Drawer - Shadcn UI"
[8]: https://baymard.com/research/ecommerce-product-lists?utm_source=chatgpt.com "E-Commerce Product Lists & Filtering UX"
[9]: https://ui.shadcn.com/docs/components/toast?utm_source=chatgpt.com "Toast - Shadcn UI"
