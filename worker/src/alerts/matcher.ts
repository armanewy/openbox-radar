export type Match = { watchId: string; count: number };

function baseUrlFromIngest(ingestUrl: string): string {
  try {
    const u = new URL(ingestUrl);
    u.pathname = '/';
    u.search = '';
    u.hash = '';
    return u.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

function getWorkerBase(env: any) {
  const url = env.INGEST_URL ? new URL(env.INGEST_URL) : null;
  if (!url) return '';
  url.pathname = '/';
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

async function fetchBestBuyAvailability(env: any, sku: string, zip: string) {
  if (env.ENABLE_BB_ENRICHMENT !== '1') return null;
  const base = getWorkerBase(env);
  if (!base) return null;
  try {
    const res = await fetch(`${base}/api/bestbuy/availability?sku=${encodeURIComponent(sku)}&zip=${encodeURIComponent(zip)}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function fetchZipLatLng(zip: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const r = await fetch(`https://api.zippopotam.us/us/${encodeURIComponent(zip)}`, { headers: { accept: 'application/json' } });
    if (!r.ok) return null;
    const j: any = await r.json();
    const p = j?.places?.[0];
    if (!p) return null;
    const lat = Number(p.latitude);
    const lng = Number(p.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

function milesBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 3958.7613;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export async function findMatches(env: any): Promise<Match[]> {
  const base = baseUrlFromIngest(env.INGEST_URL || '');
  if (!base) return [];
  const auth = `Bearer ${env.CRON_SHARED_SECRET}`;
  const r = await fetch(`${base}/api/alerts/watches`, { headers: { authorization: auth } });
  if (!r.ok) return [];
  const json: any = await r.json();
  const ws: any[] = json?.watches || [];
  const out: Match[] = [];
  for (const w of ws) {
    const m = await fetch(`${base}/api/alerts/match?watch_id=${encodeURIComponent(w.id)}&limit=5`, { headers: { authorization: auth } });
    if (!m.ok) continue;
    const matches = (await m.json())?.items || [];
    let filtered = matches;
    if ((w.retailer as string)?.toLowerCase() === 'bestbuy' && w.zipcode) {
      const sku = w.sku;
      if (sku) {
        const enrich = await fetchBestBuyAvailability(env, sku, w.zipcode);
        const stores = Array.isArray(enrich?.stores) ? enrich.stores : [];
        const radius = Number(w.radius_miles || 0);
        if (stores.length && radius > 0) {
          const origin = await fetchZipLatLng(w.zipcode);
          let hasLocal = false;
          if (origin) {
            for (const s of stores) {
              if (!s?.hasOpenBox) continue;
              const lat = typeof s.lat === 'number' ? s.lat : null;
              const lng = typeof s.lng === 'number' ? s.lng : null;
              if (lat == null || lng == null) continue;
              const d = milesBetween(origin, { lat, lng });
              if (d <= radius) { hasLocal = true; break; }
            }
          } else {
            // Fallback: if we can't locate ZIP, treat any hasOpenBox as a candidate
            hasLocal = stores.some((s: any) => s?.hasOpenBox);
          }
          if (!hasLocal) filtered = [];
        }
      }
    }
    if (filtered.length) {
      const ids = filtered.map((x: any) => x.id);
      await fetch(`${base}/api/alerts/notify`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: auth },
        body: JSON.stringify({ watchId: w.id, inventoryIds: ids }),
      });
      out.push({ watchId: w.id, count: ids.length });
    }
  }
  return out;
}
