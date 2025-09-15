import Link from "next/link";

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

  const res = await fetch(`${process.env.APP_BASE_URL ?? ""}/api/inventory/search?` + qp.toString(), {
    cache: "no-store",
    // Ensure server fetch regardless of deployment
    next: { revalidate: 0 },
  });
  const data = (await res.json()) as { items: Item[]; nextCursor?: string | null };

  const q = typeof searchParams.q === "string" ? searchParams.q : "";
  const retailer = typeof searchParams.retailer === "string" ? searchParams.retailer : "";
  const min_condition = typeof searchParams.min_condition === "string" ? searchParams.min_condition : "";
  const price_min = typeof searchParams.price_min === "string" ? searchParams.price_min : "";
  const price_max = typeof searchParams.price_max === "string" ? searchParams.price_max : "";
  const zip = typeof searchParams.zip === "string" ? searchParams.zip : "";
  const radius_miles = typeof searchParams.radius_miles === "string" ? searchParams.radius_miles : "";

  const baseParams = { q, retailer, min_condition, price_min, price_max, zip, radius_miles };

  return (
    <main className="max-w-6xl mx-auto p-6 grid grid-cols-12 gap-6">
      <aside className="col-span-12 md:col-span-3 border rounded p-4 space-y-3">
        <form method="GET" className="space-y-3">
          <div>
            <label className="block text-sm text-gray-600">Search</label>
            <input name="q" defaultValue={q} placeholder="Title or SKU" className="mt-1 w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm text-gray-600">Retailer</label>
            <select name="retailer" defaultValue={retailer} className="mt-1 w-full border rounded px-3 py-2">
              <option value="">All</option>
              <option value="bestbuy">Best Buy</option>
              <option value="microcenter">Micro Center</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600">Min condition</label>
            <select name="min_condition" defaultValue={min_condition} className="mt-1 w-full border rounded px-3 py-2">
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
              <label className="block text-sm text-gray-600">Min price</label>
              <input name="price_min" type="number" defaultValue={price_min} className="mt-1 w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm text-gray-600">Max price</label>
              <input name="price_max" type="number" defaultValue={price_max} className="mt-1 w-full border rounded px-3 py-2" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm text-gray-600">ZIP</label>
              <input name="zip" defaultValue={zip} className="mt-1 w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm text-gray-600">Radius (mi)</label>
              <input name="radius_miles" type="number" defaultValue={radius_miles} className="mt-1 w-full border rounded px-3 py-2" />
            </div>
          </div>
          <button className="w-full mt-2 px-4 py-2 bg-black text-white rounded">Apply</button>
        </form>
      </aside>

      <section className="col-span-12 md:col-span-9">
        <h1 className="text-xl font-semibold mb-4">Results</h1>
        {data.items.length === 0 && (
          <p className="text-gray-600">No results yet. Try widening your search.</p>
        )}
        <ul className="space-y-3">
          {data.items.map((it) => (
            <li key={`${it.retailer}-${it.store_id}-${it.id}`} className="border rounded p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={`inline-block w-2 h-2 rounded-full ${stalenessColor(it.seen_at)}`} />
                  <span className="text-xs text-gray-500">last seen {timeAgo(it.seen_at)}</span>
                </div>
                <a href={it.url} target="_blank" rel="noopener" className="block mt-1 text-base font-medium hover:underline">
                  {it.title}
                </a>
                <div className="mt-1 text-sm text-gray-600">
                  {it.store?.name || it.store_id}
                  {" "+(it.store?.city ? `• ${it.store.city}, ${it.store.state ?? ""}` : "")}
                </div>
                <div className="mt-1 text-sm text-gray-600">Condition: {it.condition_label}</div>
              </div>
              <div className="md:text-right">
                <div className="text-lg font-semibold">{dollars(it.price_cents)}</div>
                <div className="mt-2 flex gap-2 md:justify-end">
                  <a href={it.url} target="_blank" rel="noopener" className="px-3 py-2 border rounded">View at Retailer</a>
                  <Link href={`/app?next=${encodeURIComponent("/search?"+buildQuery(baseParams))}`} className="px-3 py-2 bg-black text-white rounded">Watch this</Link>
                </div>
              </div>
            </li>
          ))}
        </ul>

        {data.nextCursor && (
          <div className="mt-6">
            <Link
              className="px-4 py-2 border rounded"
              href={`/search?${buildQuery({ ...baseParams, cursor: data.nextCursor })}`}
            >
              Next page →
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}

