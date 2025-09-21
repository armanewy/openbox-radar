import Link from "next/link";
import BestBuyAttribution from "@/components/BestBuyAttribution";
import { absoluteUrl } from "@/lib/utils/url";
import InfiniteList from "@/components/InfiniteList";
import FilterChips from "@/components/FilterChips";
import SortMenu from "@/components/SortMenu";
import FilterDrawer from "@/components/FilterDrawer";
import SearchFiltersForm from "@/components/SearchFiltersForm";
import SaveSearchButton from "@/components/SaveSearchButton";

const QUICK_TYPE_FILTERS = [
  { value: 'LAPTOP', label: 'Laptops' },
  { value: 'MONITOR', label: 'Monitors' },
  { value: 'GPU', label: 'GPUs' },
  { value: 'TV', label: 'TVs' },
  { value: 'CONSOLE', label: 'Consoles' },
];

type Item = {
  id: number;
  retailer: string;
  store_id: string;
  sku: string | null;
  title: string;
  condition_label: string;
  condition_rank: string;
  price_cents: number;
  url: string;
  image_url: string | null;
  seen_at: string;
  product_type?: string | null;
  channel?: string | null;
  confidence?: string | null;
  distance_miles?: number | null;
  store_lat?: number | null;
  store_lng?: number | null;
  enrichment?: {
    status: 'online' | 'verifying' | 'local';
    refreshed_at?: string | null;
    stores?: Array<{ id: string; name?: string | null; city?: string | null; state?: string | null; zip?: string | null; hasOpenBox?: boolean | null }>;
  };
  store: { name: string | null; city: string | null; state: string | null; zipcode: string | null };
};

function dollars(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function timeAgo(iso: string) {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = Math.max(0, now - then);
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function stalenessColor(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins <= 15) return "bg-green-500";
  if (mins <= 120) return "bg-amber-500";
  return "bg-gray-400";
}

function buildQuery(params: Record<string, string | string[] | undefined | null>) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) {
      v
        .map((entry) => entry?.toString().trim())
        .filter((entry): entry is string => !!entry && entry.length > 0)
        .forEach((entry) => u.append(k, entry));
    } else if (v !== undefined && v !== null && String(v).length) {
      u.set(k, String(v));
    }
  }
  return u.toString();
}

export default async function SearchPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const qp = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (Array.isArray(v)) {
      v.forEach((x) => qp.append(k, x));
    } else if (v != null) {
      qp.set(k, v);
    }
  }
  if (!qp.has("limit")) qp.set("limit", "20");

  let data: { items: Item[]; nextCursor?: string | null } = { items: [], nextCursor: null };
  let errorMessage: string | null = null;

  try {
    const res = await fetch(absoluteUrl('/api/inventory/search') + '?' + qp.toString(), {
      cache: "no-store",
    });

    const contentType = res.headers.get("content-type") ?? "";
    const normalizedType = contentType.toLowerCase();
    const bodyText = await res.text();
    const bodyTrimmed = bodyText.trim();

    if (!res.ok) {
      let detail = "";

      if (bodyTrimmed.length) {
        if (normalizedType.includes("application/json")) {
          try {
            const parsed = JSON.parse(bodyTrimmed);
            if (parsed && typeof parsed === "object") {
              const maybeError = (parsed as { error?: unknown }).error;
              if (typeof maybeError === "string" && maybeError.trim().length) {
                detail = maybeError.trim();
              }
            }
          } catch {
            // ignore JSON parse failures for error payloads
          }
        }

        if (!detail) {
          detail = bodyTrimmed.slice(0, 200);
        }
      }

      const statusMessage = `Search request failed with status ${res.status}`;
      throw new Error(detail.length ? `${statusMessage}: ${detail}` : statusMessage);
    }

    if (!bodyTrimmed.length) {
      data = { items: [], nextCursor: null };
    } else if (!normalizedType.includes("application/json")) {
      throw new Error("Search response was not valid JSON");
    } else {
      let parsed: unknown;
      try {
        parsed = JSON.parse(bodyText) as { items?: unknown; nextCursor?: unknown };
      } catch {
        throw new Error("Search response could not be parsed as JSON");
      }

      if (!parsed || typeof parsed !== "object") {
        throw new Error("Search response was not structured as expected");
      }

      const items = Array.isArray((parsed as { items?: unknown }).items)
        ? ((parsed as { items?: unknown }).items as Item[])
        : [];
      const nextCursorValue = (parsed as { nextCursor?: unknown }).nextCursor;
      const nextCursor = typeof nextCursorValue === "string" || nextCursorValue == null
        ? (nextCursorValue ?? null)
        : null;

      data = { items, nextCursor };
    }
  } catch (error) {
    console.error("Failed to load search results", error);
    const fallbackMessage = "We couldn't load the latest listings. Please try again.";
    if (error instanceof Error && error.message.length) {
      const trimmed = error.message.trim();
      errorMessage = trimmed.length && trimmed !== fallbackMessage
        ? `${fallbackMessage} (${trimmed})`
        : fallbackMessage;
    } else {
      errorMessage = fallbackMessage;
    }
  }

  const q = typeof searchParams.q === "string" ? searchParams.q : "";
  const retailer = typeof searchParams.retailer === "string" ? searchParams.retailer : "";
  const sku = typeof searchParams.sku === "string" ? searchParams.sku : "";
  const min_condition = typeof searchParams.min_condition === "string" ? searchParams.min_condition : "";
  const price_min = typeof searchParams.price_min === "string" ? searchParams.price_min : ""; // USD
  const price_max = typeof searchParams.price_max === "string" ? searchParams.price_max : ""; // USD
  const zip = typeof searchParams.zip === "string" ? searchParams.zip : "";
  const radius_miles = typeof searchParams.radius_miles === "string" ? searchParams.radius_miles : "";
  const rawProductType = searchParams.product_type;
  const product_types = Array.isArray(rawProductType)
    ? rawProductType
        .flatMap((value) => value.split(',').map((s) => s.trim()))
        .filter((value) => value.length)
    : typeof rawProductType === 'string'
      ? rawProductType
          .split(',')
          .map((s) => s.trim())
          .filter((value) => value.length)
      : [];
  const uniqueProductTypes = Array.from(new Set(product_types));

  const baseParams = { q, retailer, sku, min_condition, price_min, price_max, zip, radius_miles, product_type: uniqueProductTypes };

  const showEmptyState = !errorMessage && data.items.length === 0;

  const hasBestBuy = data.items.some((it) => it.retailer === 'bestbuy');

  return (
    <main className="container mx-auto max-w-7xl p-4 md:p-6 grid grid-cols-12 gap-6">
      <aside className="col-span-12 md:col-span-3">
        <FilterDrawer>
          <SearchFiltersForm q={q} retailer={retailer} sku={sku} min_condition={min_condition} price_min={price_min} price_max={price_max} zip={zip} radius_miles={radius_miles} product_types={uniqueProductTypes} />
        </FilterDrawer>
        <div className="hidden md:block sticky top-3 border border-gray-300 rounded-xl p-4 space-y-3 bg-white shadow">
          <SearchFiltersForm q={q} retailer={retailer} sku={sku} min_condition={min_condition} price_min={price_min} price_max={price_max} zip={zip} radius_miles={radius_miles} product_types={uniqueProductTypes} />
        </div>
      </aside>

      <section className="col-span-12 md:col-span-9">
        <div className="flex items-center justify-between mb-3 gap-3">
          <h1 className="text-xl font-semibold">Results</h1>
          <div className="flex items-center gap-2">
            <SortMenu />
            <SaveSearchButton params={{
              q,
              retailer,
              sku,
              min_condition,
              price_min,
              price_max,
              zip,
              radius_miles,
              store_id: typeof searchParams.store_id === 'string' ? searchParams.store_id : ''
            }} />
        </div>
      </div>
        <FilterChips />
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {QUICK_TYPE_FILTERS.map((opt) => {
            const isActive = uniqueProductTypes.length === 1 && uniqueProductTypes[0] === opt.value;
            const next = new URLSearchParams(qp.toString());
            next.delete('cursor');
            next.delete('product_type');
            if (!isActive) {
              next.append('product_type', opt.value);
            }
            const href = `/search?${next.toString()}`;
            return (
              <Link
                key={opt.value}
                href={href}
                className={`rounded-full border px-3 py-1 text-sm transition ${isActive ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white hover:bg-gray-50 border-gray-300 text-gray-700'}`}
              >
                {opt.label}
              </Link>
            );
          })}
        </div>

        {errorMessage ? (
          <div className="text-gray-700 border rounded-xl p-6 bg-white/60">
            <div className="font-semibold mb-1">Unable to load results</div>
            <p className="text-sm">{errorMessage}</p>
          </div>
        ) : null}

        {showEmptyState && (
          <div className="text-gray-700 border rounded-xl p-6 bg-white/60">
            <div className="font-semibold mb-1">No results</div>
            <p className="text-sm mb-3">Try clearing filters or using broader keywords.</p>
            <div className="flex items-center gap-3 text-sm">
              <Link href="/search" className="px-3 py-1.5 border rounded">Clear all</Link>
              <Link href="/" className="underline">See trending</Link>
              <Link href="/stores" className="underline">Browse stores</Link>
            </div>
          </div>
        )}

        {!errorMessage ? (
          <InfiniteList
            fetchUrl={absoluteUrl('/api/inventory/search')}
            baseParams={baseParams}
            initialItems={data.items}
            initialNextCursor={data.nextCursor}
          />
        ) : null}

        {!errorMessage && hasBestBuy ? <BestBuyAttribution /> : null}
      </section>
    </main>
  );
}
