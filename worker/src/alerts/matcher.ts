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
          const hasLocal = stores.some((s: any) => s?.hasOpenBox);
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
