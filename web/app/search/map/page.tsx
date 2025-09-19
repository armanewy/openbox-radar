import Link from "next/link";
import { absoluteUrl } from "@/lib/utils/url";

type Item = {
  id: number;
  retailer: string;
  store_id: string;
  title: string;
  price_cents: number;
  url: string;
  distance_miles?: number | null;
  store: { name: string | null; city: string | null; state: string | null; zipcode: string | null };
};

function dollars(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function MapView({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const qp = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (Array.isArray(v)) v.forEach((x) => qp.append(k, x));
    else if (v != null) qp.set(k, v);
  }
  if (!qp.has("limit")) qp.set("limit", "200");
  const res = await fetch(absoluteUrl('/api/inventory/search') + '?' + qp.toString(), { cache: 'no-store', next: { revalidate: 0 } });
  const data = (await res.json()) as { items: Item[] };

  // Group items by store
  const byStore = new Map<string, { storeId: string; name: string; city: string; state: string; dist: number | null; items: Item[] }>();
  for (const it of data.items) {
    const key = `${it.retailer}:${it.store_id}`;
    const name = it.store?.name || it.store_id;
    const city = it.store?.city || '';
    const state = it.store?.state || '';
    const d = typeof it.distance_miles === 'number' ? it.distance_miles! : null;
    const cur = byStore.get(key);
    if (!cur) {
      byStore.set(key, { storeId: it.store_id, name: name || it.store_id, city, state, dist: d, items: [it] });
    } else {
      cur.items.push(it);
      if (cur.dist == null && d != null) cur.dist = d; // take first known distance
    }
  }
  const stores = Array.from(byStore.values()).sort((a, b) => (a.dist ?? Infinity) - (b.dist ?? Infinity));

  return (
    <main className="container mx-auto max-w-6xl p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Nearby stores</h1>
        <Link href="/search" className="underline">Back to list</Link>
      </div>
      {stores.length === 0 ? (
        <div className="border rounded-xl p-6 bg-white/60 text-gray-700">No items match your filters.</div>
      ) : (
        <ul className="space-y-4">
          {stores.map((s) => (
            <li key={s.storeId} className="rounded-xl border bg-white/70 p-4">
              <div className="flex items-center justify-between">
                <div className="font-semibold">
                  {s.name}
                  <span className="ml-2 text-sm text-gray-600">{s.city}{s.state ? `, ${s.state}` : ''}</span>
                </div>
                {s.dist != null ? <div className="text-sm text-gray-700">~{s.dist.toFixed(1)} mi</div> : null}
              </div>
              <ul className="mt-3 grid md:grid-cols-2 gap-2">
                {s.items.slice(0, 6).map((it) => (
                  <li key={it.id} className="text-sm truncate">
                    <a className="underline" href={it.url} target="_blank" rel="noopener noreferrer">{it.title}</a>
                    <span className="ml-2 font-medium">{dollars(it.price_cents)}</span>
                  </li>
                ))}
              </ul>
              {s.items.length > 6 ? (
                <div className="mt-2 text-sm text-gray-600">and {s.items.length - 6} more…</div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

