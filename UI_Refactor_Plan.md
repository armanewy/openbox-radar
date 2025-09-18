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


---


# IMPLEMENTATION PLAN



Here are **drop-in scaffolds** for: **ItemCard**, **WatchSheet (drawer form)**, and **FilterDrawer**. They’re pure React + Tailwind (no extra deps), so we can paste and iterate right away. All three use a tiny, reusable **Sheet** (drawer) component I included first.

> Paths assume `web/` as project root. Adjust imports to your taste.

---

## 1) Reusable Drawer (“Sheet”)

**`web/components/ui/Sheet.tsx`**

```tsx
'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';

type SheetProps = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  side?: 'right' | 'left' | 'bottom';
  ariaLabel?: string;
};

export default function Sheet({
  open,
  onClose,
  children,
  side = 'right',
  ariaLabel = 'Panel',
}: SheetProps) {
  // Close on Esc
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      aria-hidden={!open}
      className={clsx(
        'fixed inset-0 z-50 transition',
        open ? 'pointer-events-auto' : 'pointer-events-none'
      )}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={clsx(
          'absolute inset-0 bg-black/50 transition-opacity',
          open ? 'opacity-100' : 'opacity-0'
        )}
      />
      {/* Panel */}
      <section
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className={clsx(
          'absolute bg-white dark:bg-zinc-900 shadow-2xl',
          'flex h-full w-full max-w-md flex-col',
          side === 'right' && 'right-0 top-0 translate-x-full',
          side === 'left' && 'left-0 top-0 -translate-x-full',
          side === 'bottom' && 'left-0 right-0 bottom-0 translate-y-full h-[85vh] max-w-none',
          open ? 'translate-x-0 translate-y-0' : '',
          'transition-transform duration-300 ease-out'
        )}
        style={{ willChange: 'transform' }}
      >
        {children}
      </section>
    </div>,
    document.body
  );
}
```

> Uses only Tailwind + `clsx`. If you don’t have `clsx`, replace with template strings or `pnpm add clsx`.

---

## 2) “Watch this” drawer (async, optimistic)

**`web/components/watch/WatchSheet.tsx`**

```tsx
'use client';

import { useState, useTransition } from 'react';
import Sheet from '@/components/ui/Sheet';

type WatchSheetProps = {
  open: boolean;
  onClose: () => void;
  // Prefill from context (card/search)
  context?: {
    retailer: 'bestbuy' | 'microcenter' | string;
    sku?: string | null;
    storeId?: string | null;
    keywords?: string[] | null;
    zipcode?: string | null;
    radiusMiles?: number | null;
    title?: string | null;
  };
};

export default function WatchSheet({ open, onClose, context }: WatchSheetProps) {
  const [sku, setSku] = useState(context?.sku ?? '');
  const [retailer, setRetailer] = useState(context?.retailer ?? 'bestbuy');
  const [zipcode, setZipcode] = useState(context?.zipcode ?? '');
  const [radius, setRadius] = useState(context?.radiusMiles ?? 25);
  const [priceCeiling, setPriceCeiling] = useState<number | ''>('');
  const [stores, setStores] = useState<string[]>(context?.storeId ? [context.storeId] : []);
  const [minCondition, setMinCondition] = useState<'new'|'excellent'|'very_good'|'good'|'fair'|'satisfactory'|'open_box'|'like_new'|'used'|string>('satisfactory');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function toggleStore(id: string) {
    setStores(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  }

  async function onSubmit() {
    setError(null);
    const body = {
      retailer,
      sku: sku || null,
      zipcode: zipcode || null,
      radiusMiles: Number(radius) || null,
      stores: stores.length ? stores : null,
      minCondition,
      priceCeilingCents: priceCeiling === '' ? null : Math.round(Number(priceCeiling) * 100),
      // NOTE: server infers user from session cookie
    };

    startTransition(async () => {
      try {
        const res = await fetch('/api/watches', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.error ?? `Failed (${res.status})`);
        }
        setDone(true);
        setTimeout(() => onClose(), 600);
      } catch (e: any) {
        setError(e.message || 'Something went wrong');
      }
    });
  }

  return (
    <Sheet open={open} onClose={onClose} ariaLabel="Create watch">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-200/70 px-4 py-3">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold">Create watch</h3>
          {context?.title ? (
            <p className="truncate text-xs text-zinc-500">{context.title}</p>
          ) : null}
        </div>
        <button onClick={onClose} className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100">
          ✕
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto px-4 py-4 space-y-4">
        {/* Retailer */}
        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1">Retailer</label>
          <select
            value={retailer}
            onChange={(e) => setRetailer(e.target.value)}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
          >
            <option value="bestbuy">Best Buy</option>
            <option value="microcenter">Micro Center</option>
          </select>
        </div>

        {/* SKU */}
        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1">
            SKU (optional if using keywords)
          </label>
          <input
            value={sku ?? ''}
            onChange={(e) => setSku(e.target.value)}
            placeholder="e.g., 6487443"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>

        {/* Location */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Zipcode</label>
            <input
              value={zipcode ?? ''}
              onChange={(e) => setZipcode(e.target.value)}
              placeholder="e.g., 94016"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Radius (miles)</label>
            <input
              type="number"
              min={1}
              value={Number(radius)}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        {/* Stores (optional; you can replace with a searchable list later) */}
        {context?.storeId ? (
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Stores</label>
            <button
              type="button"
              onClick={() => toggleStore(context.storeId!)}
              className={`text-xs rounded-full px-3 py-1 border ${
                stores.includes(context.storeId!) ? 'bg-zinc-900 text-white' : 'bg-white'
              }`}
            >
              {context.storeId} {stores.includes(context.storeId!) ? '✓' : '+'}
            </button>
          </div>
        ) : null}

        {/* Price ceiling & condition */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Price ceiling ($)</label>
            <input
              type="number"
              min={0}
              step="1"
              value={priceCeiling}
              onChange={(e) => setPriceCeiling(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="optional"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Min condition</label>
            <select
              value={minCondition}
              onChange={(e) => setMinCondition(e.target.value)}
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
            >
              <option value="new">New</option>
              <option value="excellent">Excellent</option>
              <option value="very_good">Very good</option>
              <option value="good">Good</option>
              <option value="satisfactory">Satisfactory</option>
              <option value="fair">Fair</option>
            </select>
          </div>
        </div>

        {/* Error / Success */}
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        {done ? <p className="text-sm text-emerald-600">Watching! You’ll get alerts.</p> : null}
      </div>

      {/* Footer */}
      <div className="border-t border-zinc-200/70 px-4 py-3 flex gap-2">
        <button
          onClick={onClose}
          className="px-3 py-2 text-sm rounded-md border border-zinc-300 hover:bg-zinc-50"
        >
          Cancel
        </button>
        <button
          onClick={onSubmit}
          disabled={pending}
          className="px-3 py-2 text-sm rounded-md bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {pending ? 'Saving…' : 'Create watch'}
        </button>
      </div>
    </Sheet>
  );
}
```

---

## 3) Search filters in a Drawer (mobile/compact)

**`web/components/search/FilterDrawer.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Sheet from '@/components/ui/Sheet';

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function FilterDrawer({ open, onClose }: Props) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [retailer, setRetailer] = useState(sp.get('retailer') ?? '');
  const [sku, setSku] = useState(sp.get('sku') ?? '');
  const [minCond, setMinCond] = useState(sp.get('min_condition') ?? '');
  const [minPrice, setMinPrice] = useState(sp.get('min_price') ?? '');
  const [maxPrice, setMaxPrice] = useState(sp.get('max_price') ?? '');
  const [zipcode, setZipcode] = useState(sp.get('zipcode') ?? '');
  const [radius, setRadius] = useState(sp.get('radius_miles') ?? '');

  // Reset local state when opened (keeps in sync with URL)
  useEffect(() => {
    if (!open) return;
    setRetailer(sp.get('retailer') ?? '');
    setSku(sp.get('sku') ?? '');
    setMinCond(sp.get('min_condition') ?? '');
    setMinPrice(sp.get('min_price') ?? '');
    setMaxPrice(sp.get('max_price') ?? '');
    setZipcode(sp.get('zipcode') ?? '');
    setRadius(sp.get('radius_miles') ?? '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function apply() {
    const params = new URLSearchParams(sp.toString());
    function setOrDelete(key: string, val: string) {
      if (val && String(val).length) params.set(key, val);
      else params.delete(key);
    }
    setOrDelete('retailer', retailer);
    setOrDelete('sku', sku);
    setOrDelete('min_condition', minCond);
    setOrDelete('min_price', minPrice);
    setOrDelete('max_price', maxPrice);
    setOrDelete('zipcode', zipcode);
    setOrDelete('radius_miles', radius);

    router.push(`${pathname}?${params.toString()}`);
    onClose();
  }

  function clearAll() {
    const params = new URLSearchParams(sp.toString());
    ['retailer','sku','min_condition','min_price','max_price','zipcode','radius_miles']
      .forEach(k => params.delete(k));
    router.push(`${pathname}?${params.toString()}`);
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} ariaLabel="Filters" side="left">
      <div className="flex items-center justify-between border-b border-zinc-200/70 px-4 py-3">
        <h3 className="text-lg font-semibold">Filters</h3>
        <button onClick={onClose} className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100">✕</button>
      </div>

      <div className="flex-1 overflow-auto px-4 py-4 space-y-4">
        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1">Retailer</label>
          <select
            value={retailer}
            onChange={(e) => setRetailer(e.target.value)}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">All</option>
            <option value="bestbuy">Best Buy</option>
            <option value="microcenter">Micro Center</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1">SKU</label>
          <input
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            placeholder="e.g., 6487443"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Min price ($)</label>
            <input
              type="number"
              min={0}
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Max price ($)</label>
            <input
              type="number"
              min={0}
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Min condition</label>
            <select
              value={minCond}
              onChange={(e) => setMinCond(e.target.value)}
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">Any</option>
              <option value="excellent">Excellent</option>
              <option value="very_good">Very good</option>
              <option value="good">Good</option>
              <option value="satisfactory">Satisfactory</option>
              <option value="fair">Fair</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Radius (miles)</label>
            <input
              type="number"
              min={1}
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
              placeholder="e.g., 25"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1">Zipcode</label>
          <input
            value={zipcode}
            onChange={(e) => setZipcode(e.target.value)}
            placeholder="e.g., 94016"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="border-t border-zinc-200/70 px-4 py-3 flex gap-2">
        <button onClick={clearAll} className="px-3 py-2 text-sm rounded-md border border-zinc-300 hover:bg-zinc-50">
          Clear all
        </button>
        <button onClick={apply} className="px-3 py-2 text-sm rounded-md bg-zinc-900 text-white hover:bg-zinc-800">
          Apply
        </button>
      </div>
    </Sheet>
  );
}
```

---

## 4) Item card (image-forward, badges, async Watch)

**`web/components/cards/ItemCard.tsx`**

```tsx
'use client';

import { useState } from 'react';
import Image from 'next/image';
import WatchSheet from '@/components/watch/WatchSheet';

type Item = {
  id?: number | string;
  retailer: 'bestbuy' | 'microcenter' | string;
  title: string;
  sku?: string | null;
  storeId?: string | null;
  storeName?: string | null;
  city?: string | null;
  conditionLabel?: string | null;
  conditionRank?: string | null;
  priceCents?: number | null;
  url?: string | null;
  imageUrl?: string | null;
  lastSeenIso?: string | null; // ISO string from seenAt
};

function money(cents?: number | null) {
  const v = (cents ?? 0) / 100;
  return v.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function timeAgo(iso?: string | null) {
  if (!iso) return '';
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  const map: [number, string][] = [
    [60, 's'], [60, 'm'], [24, 'h'], [7, 'd'], [4.348, 'w'], [12, 'mo']
  ];
  let val = s; let i = 0; let unit: string = 's';
  for (; i < map.length; i++) {
    const [div, u] = map[i];
    if (val < div) { unit = u; break; }
    val = Math.floor(val / div); unit = u;
  }
  return `${val}${unit}`;
}

export default function ItemCard({ item }: { item: Item }) {
  const [openWatch, setOpenWatch] = useState(false);

  const retailerChip =
    item.retailer === 'bestbuy' ? 'bg-blue-600 text-white' :
    item.retailer === 'microcenter' ? 'bg-emerald-600 text-white' :
    'bg-zinc-200 text-zinc-800';

  return (
    <>
      <article className="group relative overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition hover:shadow-md">
        {/* Image */}
        <div className="relative aspect-[4/3] w-full bg-zinc-100">
          {item.imageUrl ? (
            <Image
              src={item.imageUrl}
              alt={item.title}
              fill
              className="object-contain"
              sizes="(max-width: 768px) 100vw, 33vw"
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-zinc-400">
              <span className="text-xs">No image</span>
            </div>
          )}
          {/* Retailer */}
          <div className="absolute left-2 top-2 rounded-full px-2.5 py-1 text-xs font-medium shadow-sm backdrop-blur bg-white/80">
            <span className={`rounded-full px-2 py-0.5 text-[10px] ${retailerChip}`}>{item.retailer}</span>
          </div>
          {/* Last seen */}
          {item.lastSeenIso ? (
            <div className="absolute right-2 top-2 rounded-full bg-zinc-900/80 px-2.5 py-1 text-xs text-white">
              seen {timeAgo(item.lastSeenIso)} ago
            </div>
          ) : null}
        </div>

        {/* Body */}
        <div className="p-3">
          <h3 className="line-clamp-2 text-sm font-medium text-zinc-900 group-hover:underline">
            {item.title}
          </h3>
          <div className="mt-2 flex items-center gap-2 text-xs text-zinc-600">
            {item.conditionLabel ? (
              <span className="rounded-full bg-zinc-100 px-2 py-0.5">{item.conditionLabel}</span>
            ) : null}
            {item.city ? <span className="rounded-full bg-zinc-100 px-2 py-0.5">{item.city}</span> : null}
            {item.sku ? <span className="rounded-full bg-zinc-100 px-2 py-0.5">SKU {item.sku}</span> : null}
          </div>

          <div className="mt-3 flex items-end justify-between">
            <div className="text-lg font-semibold">{money(item.priceCents)}</div>
            <div className="flex gap-2">
              <button
                onClick={() => setOpenWatch(true)}
                className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs hover:bg-zinc-50"
                title="Watch this"
              >
                Watch
              </button>
              {item.url ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="nofollow noopener noreferrer"
                  className="rounded-md bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-zinc-800"
                >
                  View at retailer
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </article>

      {/* Drawer */}
      <WatchSheet
        open={openWatch}
        onClose={() => setOpenWatch(false)}
        context={{
          retailer: item.retailer,
          sku: item.sku ?? undefined,
          storeId: item.storeId ?? undefined,
          title: item.title,
        }}
      />
    </>
  );
}
```

---

## 5) Light integration examples

### Search page toolbar (open filter drawer + chips)

Add to `web/app/search/page.tsx` (or a toolbar component):

```tsx
'use client';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import FilterDrawer from '@/components/search/FilterDrawer';

export function SearchToolbar() {
  const [open, setOpen] = useState(false);
  const sp = useSearchParams();

  const chips = [
    sp.get('retailer') && { k: 'retailer', v: sp.get('retailer') },
    sp.get('sku') && { k: 'SKU', v: sp.get('sku') },
    sp.get('min_condition') && { k: 'min', v: sp.get('min_condition') },
    (sp.get('min_price') || sp.get('max_price')) && { k: 'price', v: `${sp.get('min_price') ?? '0'}–${sp.get('max_price') ?? '∞'}` },
  ].filter(Boolean) as {k:string;v:string}[];

  return (
    <div className="mb-3 flex items-center justify-between">
      <div className="flex flex-wrap gap-2">
        {chips.map((c, i) => (
          <span key={i} className="rounded-full bg-zinc-100 px-3 py-1 text-xs">{c.k}: {c.v}</span>
        ))}
      </div>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50"
      >
        Filters
      </button>
      <FilterDrawer open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
```

### Use `ItemCard` in your grid

```tsx
import ItemCard from '@/components/cards/ItemCard';

// inside your results
<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
  {items.map((it) => (
    <ItemCard key={`${it.retailer}-${it.storeId ?? ''}-${it.sku ?? it.id}`} item={it} />
  ))}
</div>
```

---

## Notes / next steps

* **Optimistic dashboard update:** when creating a watch, if you’re on a page that lists watches, add a callback to update local state optimistically (or use TanStack Query later).
* **Toasts:** If you want toasts, drop in **Sonner** (`pnpm add sonner`) and in `WatchSheet` replace success/error paragraphs with `toast.success(...)`/`toast.error(...)`.
* **Images:** For Best Buy, pass `imageUrl` from your Worker’s ingest (they’re already available in the Product/Buying Options payloads). Fallback to retailer logos for Micro Center.
* **Accessibility:** The custom Sheet has focus/esc basics; you can enhance with focus-trap later (or swap to shadcn/ui’s `Sheet` component if you add that lib).

This is all technically compatible with your current code: no new server routes needed, uses your existing `/api/watches` endpoint, and stays in-page for a smoother experience.
