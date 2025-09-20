"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import StoreMap from "@/components/StoreMap";

type Item = {
  id: number;
  retailer: string;
  store_id: string;
  title: string;
  price_cents: number;
  url: string;
  distance_miles?: number | null;
  image_url?: string | null;
  store_lat?: number | null;
  store_lng?: number | null;
  enrichment?: {
    status: 'online' | 'verifying' | 'local';
    refreshed_at?: string | null;
    stores?: Array<{ id: string; name?: string; city?: string | null; state?: string | null; zip?: string | null; lat?: number | null; lng?: number | null; hasOpenBox?: boolean | null }>;
  };
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
      const res = await fetch('/api/inventory/search?' + params.toString(), { cache: 'no-store' });
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

  type StoreGroup = {
    retailer: string;
    storeId: string;
    name: string;
    city: string;
    state: string;
    dist: number | null;
    items: Item[];
    lat?: number | null;
    lng?: number | null;
    local?: boolean;
  };

  const byStore = new Map<string, StoreGroup>();

  function addToGroup(key: string, info: Partial<StoreGroup>, item: Item) {
    const existing = byStore.get(key);
    if (existing) {
      existing.items.push(item);
      if (existing.dist == null && info.dist != null) existing.dist = info.dist;
      if (existing.lat == null && info.lat != null) existing.lat = info.lat;
      if (existing.lng == null && info.lng != null) existing.lng = info.lng;
      if (info.local) existing.local = true;
    } else {
      byStore.set(key, {
        retailer: info.retailer || item.retailer,
        storeId: info.storeId || item.store_id,
        name: info.name || item.store?.name || item.store_id,
        city: info.city ?? item.store?.city ?? '',
        state: info.state ?? item.store?.state ?? '',
        dist: info.dist ?? (typeof item.distance_miles === 'number' ? item.distance_miles : null),
        items: [item],
        lat: info.lat ?? item.store_lat ?? null,
        lng: info.lng ?? item.store_lng ?? null,
        local: info.local,
      });
    }
  }

  for (const it of items) {
    if (it.retailer === 'bestbuy' && it.enrichment?.stores?.length) {
      for (const store of it.enrichment.stores) {
        addToGroup(`bestbuy:${store.id}`, {
          retailer: 'bestbuy',
          storeId: String(store.id),
          name: store.name || `Best Buy ${store.city ?? ''}`.trim(),
          city: store.city ?? '',
          state: store.state ?? '',
          lat: store.lat ?? null,
          lng: store.lng ?? null,
          local: store.hasOpenBox ?? undefined,
        }, it);
      }
      continue;
    }

    const key = `${it.retailer}:${it.store_id}`;
    addToGroup(key, { retailer: it.retailer, storeId: it.store_id }, it);
  }

  const stores = Array.from(byStore.values()).sort((a, b) => (a.dist ?? Infinity) - (b.dist ?? Infinity));
  const origin = (() => {
    const lat = sp.get('lat');
    const lng = sp.get('lng');
    if (lat && lng) return { lat: Number(lat), lng: Number(lng) };
    return null;
  })();
  const pins = stores
    .map((s) => {
      if (s.lat == null || s.lng == null) return null;
      if (s.retailer === 'bestbuy' && !s.local) return null;
      return {
        id: `${s.retailer}:${s.storeId}`,
        name: s.name,
        lat: Number(s.lat),
        lng: Number(s.lng),
        count: s.items.length,
        dist: s.dist ?? null,
        browseUrl: `/search?retailer=${encodeURIComponent(s.retailer)}&store_id=${encodeURIComponent(s.storeId)}`,
      };
    })
    .filter(Boolean) as any[];

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
      <div className="mb-5">
        <StoreMap pins={pins} origin={origin || undefined} />
        <div className="mt-2 text-xs text-gray-500 flex flex-wrap gap-4">
          <span>Solid pin = local availability verified</span>
          <span>Hollow pin = other retailers with store coordinates</span>
        </div>
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
                  {s.retailer === 'bestbuy' ? (
                    <span className={`px-2 py-0.5 rounded-full text-xs ${s.local ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-700'}`}>
                      {s.local ? 'Local store' : 'Online only'}
                    </span>
                  ) : null}
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
                      {it.url.includes('bestbuy.com') && it.image_url ? (
                        <Image src={it.image_url} alt={it.title} width={40} height={40} className="object-contain h-10 w-10" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={it.image_url || '/favicon.ico'} alt="" className="object-contain h-10 w-10" />
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
