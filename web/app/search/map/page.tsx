"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { absoluteUrl } from "@/lib/utils/url";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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

export default function MapView() {
  const sp = useSearchParams();
  const router = useRouter();
  const [zip, setZip] = useState<string>(sp.get('zip') || '');
  const [radius, setRadius] = useState<number>(Number(sp.get('radius_miles') || 25));
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [locErr, setLocErr] = useState('');

  const qp = useMemo(() => {
    const u = new URLSearchParams(sp.toString());
    if (!u.has('limit')) u.set('limit', '200');
    return u;
  }, [sp]);

  async function fetchItems(params: URLSearchParams) {
    setLoading(true);
    try {
      const res = await fetch(absoluteUrl('/api/inventory/search') + '?' + params.toString(), { cache: 'no-store' });
      const data = (await res.json()) as { items: Item[] };
      setItems(data.items || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchItems(qp); }, [qp]);

  function applyZip() {
    const u = new URLSearchParams(sp.toString());
    if (zip) u.set('zip', zip); else u.delete('zip');
    u.set('radius_miles', String(radius || 25));
    router.push('/search/map?' + u.toString());
  }

  function useMyLocation() {
    setLocErr('');
    if (!('geolocation' in navigator)) {
      setLocErr('Geolocation not available');
      return;
    }
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude, longitude } = pos.coords;
      const u = new URLSearchParams(sp.toString());
      u.delete('zip');
      u.set('lat', String(latitude));
      u.set('lng', String(longitude));
      u.set('radius_miles', String(radius || 25));
      router.push('/search/map?' + u.toString());
    }, (err) => setLocErr(err?.message || 'Location permission denied'), { enableHighAccuracy: false, maximumAge: 300000, timeout: 10000 });
  }

  // Group items by store
  const byStore = new Map<string, { retailer: string; storeId: string; name: string; city: string; state: string; dist: number | null; items: Item[] }>();
  for (const it of items) {
    const key = `${it.retailer}:${it.store_id}`;
    const name = it.store?.name || it.store_id;
    const city = it.store?.city || '';
    const state = it.store?.state || '';
    const d = typeof it.distance_miles === 'number' ? it.distance_miles! : null;
    const cur = byStore.get(key);
    if (!cur) {
      byStore.set(key, { retailer: it.retailer, storeId: it.store_id, name: name || it.store_id, city, state, dist: d, items: [it] });
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
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <div className="flex items-center gap-2">
          <div>
            <label className="block text-sm text-gray-600">ZIP</label>
            <Input value={zip} onChange={(e) => setZip(e.target.value)} placeholder="02139" className="w-28" />
          </div>
          <div>
            <label className="block text-sm text-gray-600">Radius (mi)</label>
            <Input type="number" value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="w-24" />
          </div>
          <Button onClick={applyZip}>Apply</Button>
        </div>
        <Button variant="outline" onClick={useMyLocation}>Use my location</Button>
        {locErr ? <div className="text-sm text-red-600">{locErr}</div> : null}
      </div>
      {stores.length === 0 ? (
        <div className="border rounded-xl p-6 bg-white/60 text-gray-700">No items match your filters.</div>
      ) : (
        <ul className="space-y-4">
          {stores.map((s) => (
            <li key={s.storeId} className="rounded-xl border border-gray-300 bg-white p-4 shadow">
              <div className="flex items-center justify-between">
                <div className="font-semibold">
                  {s.name}
                  <span className="ml-2 text-sm text-gray-600">{s.city}{s.state ? `, ${s.state}` : ''}</span>
                </div>
                <div className="text-sm text-gray-700 flex items-center gap-3">
                  <span className="text-gray-500">{s.items.length} items</span>
                  {s.dist != null ? <span>~{s.dist.toFixed(1)} mi</span> : null}
                  <Link href={`/search?retailer=${encodeURIComponent(s.retailer)}&store_id=${encodeURIComponent(s.storeId)}`} className="underline">Browse</Link>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                {s.items.slice(0, 4).map((it) => (
                  <a key={it.id} href={it.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 truncate">
                    <div className="h-10 w-10 bg-white border rounded flex items-center justify-center overflow-hidden">
                      {/* Prefer Next/Image for Best Buy CDN */}
                      {it.url.includes('bestbuy.com') && it['image_url'] ? (
                        <Image src={(it as any).image_url} alt={it.title} width={40} height={40} className="object-contain h-10 w-10" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={(it as any).image_url || '/favicon.ico'} alt="" className="object-contain h-10 w-10" />
                      )}
                    </div>
                    <div className="min-w-0 text-sm">
                      <div className="truncate underline">{it.title}</div>
                      <div className="text-gray-600">{dollars(it.price_cents)}</div>
                    </div>
                  </a>
                ))}
              </div>
              {s.items.length > 4 ? (
                <div className="mt-2 text-sm text-gray-600">and {s.items.length - 4} more…</div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
