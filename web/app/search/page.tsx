import Link from "next/link";
import BestBuyAttribution from "@/components/BestBuyAttribution";
import { absoluteUrl } from "@/lib/utils/url";
import InfiniteList from "@/components/InfiniteList";
import FilterChips from "@/components/FilterChips";
import SortMenu from "@/components/SortMenu";

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

function buildQuery(params: Record<string, string | undefined | null>) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && String(v).length) u.set(k, String(v));
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

  const res = await fetch(absoluteUrl('/api/inventory/search') + '?' + qp.toString(), {
    cache: "no-store",
    // Ensure server fetch regardless of deployment
    next: { revalidate: 0 },
  });
  const data = (await res.json()) as { items: Item[]; nextCursor?: string | null };

  const q = typeof searchParams.q === "string" ? searchParams.q : "";
  const retailer = typeof searchParams.retailer === "string" ? searchParams.retailer : "";
  const sku = typeof searchParams.sku === "string" ? searchParams.sku : "";
  const min_condition = typeof searchParams.min_condition === "string" ? searchParams.min_condition : "";
  const price_min = typeof searchParams.price_min === "string" ? searchParams.price_min : ""; // USD
  const price_max = typeof searchParams.price_max === "string" ? searchParams.price_max : ""; // USD
  const zip = typeof searchParams.zip === "string" ? searchParams.zip : "";
  const radius_miles = typeof searchParams.radius_miles === "string" ? searchParams.radius_miles : "";

  const baseParams = { q, retailer, sku, min_condition, price_min, price_max, zip, radius_miles };

  const hasBestBuy = data.items.some((it) => it.retailer === 'bestbuy');

  return (
    <main className="container mx-auto max-w-7xl p-4 md:p-6 grid grid-cols-12 gap-6">
      <aside className="col-span-12 md:col-span-3">
        <div className="sticky top-3 border rounded-xl p-4 space-y-3 bg-white/70 backdrop-blur shadow-card">
          <form method="GET" className="space-y-3">
            <div>
              <label className="block text-sm text-gray-600">Search</label>
              <input name="q" defaultValue={q} placeholder="Title or SKU"
                     className="mt-1 w-full border rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm text-gray-600">Retailer</label>
              <select name="retailer" defaultValue={retailer} className="mt-1 w-full border rounded-lg px-3 py-2">
                <option value="">All</option>
                <option value="bestbuy">Best Buy</option>
                <option value="microcenter">Micro Center</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600">SKU</label>
              <input name="sku" defaultValue={sku} placeholder="Exact or partial" className="mt-1 w-full border rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm text-gray-600">Min condition</label>
              <select name="min_condition" defaultValue={min_condition} className="mt-1 w-full border rounded-lg px-3 py-2">
                <option value="">Any</option>
                <option value="certified">Certified</option>
                <option value="excellent">Excellent</option>
                <option value="satisfactory">Satisfactory</option>
                <option value="fair">Fair</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm text-gray-600">Min price (USD)</label>
                <input name="price_min" type="number" defaultValue={price_min} className="mt-1 w-full border rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm text-gray-600">Max price (USD)</label>
                <input name="price_max" type="number" defaultValue={price_max} className="mt-1 w-full border rounded-lg px-3 py-2" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm text-gray-600">ZIP</label>
                <input name="zip" defaultValue={zip} className="mt-1 w-full border rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm text-gray-600">Radius (mi)</label>
                <input name="radius_miles" type="number" defaultValue={radius_miles} className="mt-1 w-full border rounded-lg px-3 py-2" />
              </div>
            </div>
            <button className="w-full mt-2 px-4 py-2 bg-black text-white rounded-lg">Apply</button>
          </form>
        </div>
      </aside>

      <section className="col-span-12 md:col-span-9">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-semibold">Results</h1>
          <SortMenu />
        </div>
        <FilterChips />

        {data.items.length === 0 && (
          <p className="text-gray-600">No results yet. Try widening your search.</p>
        )}

        <InfiniteList
          fetchUrl={absoluteUrl('/api/inventory/search')}
          baseParams={baseParams}
          initialItems={data.items}
          initialNextCursor={data.nextCursor}
        />

        {hasBestBuy ? <BestBuyAttribution /> : null}
      </section>
    </main>
  );
}
