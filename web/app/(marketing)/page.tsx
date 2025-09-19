import SearchHero from "@/components/SearchHero";
import RadarSweep from "@/components/RadarSweep";
import NearYou from "@/components/NearYou";
import { absoluteUrl } from "@/lib/utils/url";
import Link from "next/link";

type Item = { id: number; title: string; price_cents: number; url: string };
function dollars(n: number) { return `$${(n/100).toFixed(2)}`; }

async function fetchDrops(): Promise<Item[]> {
  const res = await fetch(absoluteUrl('/api/inventory/trending?type=drops&limit=8'), { cache: 'no-store', next: { revalidate: 0 } });
  const json = await res.json();
  return (json.items || []) as Item[];
}

export default async function Page() {
  const drops = await fetchDrops();
  return (
    <main className="container mx-auto max-w-7xl p-6 space-y-10">
      <section>
        <SearchHero subtitle="Real-time open-box deals with local alerts & price history." />
      </section>

      <section className="grid md:grid-cols-2 gap-6">
        <div className="rounded-xl border p-4 bg-white/70">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">Hot Now</h2>
            <Link href="/search" className="text-sm underline">Browse all</Link>
          </div>
          <RadarSweep blips={(drops || []).map((d, i) => ({ id: String(d.id), x: (i*13)%90 + 5, y: (i*23)%80 + 10 }))} />
          <ul className="mt-3 space-y-2">
            {drops.length === 0 ? <li className="text-sm text-gray-600">No price drops detected.</li> : null}
            {drops.map((it) => (
              <li key={it.id} className="text-sm truncate">
                <a className="underline" href={it.url} target="_blank" rel="noopener noreferrer">{it.title}</a>
                <span className="ml-2 font-medium">{dollars(it.price_cents)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border p-4 bg-white/70">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">Near You</h2>
            <Link href="/search/map" className="text-sm underline">Map</Link>
          </div>
          <p className="text-sm text-gray-600 mb-3">Save a ZIP once; we’ll use it for local search and alerts.</p>
          <NearYou />
        </div>
      </section>
    </main>
  );
}
