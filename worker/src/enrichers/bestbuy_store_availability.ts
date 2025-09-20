type Env = { [key: string]: string | undefined };

export type BestBuyStore = {
  id: string;
  name: string;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  lat?: number | null;
  lng?: number | null;
  hasOpenBox?: boolean;
};

export type StoreAvailability = {
  sku: string;
  zip: string;
  stores: BestBuyStore[];
  refreshedAt: string | null;
  fromCache: boolean;
  failed: boolean;
};

function baseUrlFromEnv(env: Env): string {
  const ingest = env.INGEST_URL || '';
  try {
    const url = new URL(ingest);
    return `${url.protocol}//${url.host}`;
  } catch {
    if (!ingest) return '';
    const idx = ingest.indexOf('/api/');
    return idx >= 0 ? ingest.slice(0, idx) : ingest;
  }
}

function authHeaders(env: Env) {
  const secret = env.CRON_SHARED_SECRET;
  return secret ? { authorization: `Bearer ${secret}` } : {};
}

async function fetchCache(env: Env, sku: string, zip: string) {
  const base = baseUrlFromEnv(env);
  const res = await fetch(`${base}/api/bestbuy/enrichment?sku=${encodeURIComponent(sku)}&zip=${encodeURIComponent(zip)}`, {
    headers: { 'content-type': 'application/json', ...authHeaders(env) },
  });
  if (!res.ok) return null;
  return res.json();
}

async function saveCache(env: Env, payload: { sku: string; zip: string; stores: BestBuyStore[]; failed?: boolean }) {
  const base = baseUrlFromEnv(env);
  await fetch(`${base}/api/bestbuy/enrichment`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...authHeaders(env) },
    body: JSON.stringify(payload),
  });
}

async function fetchFromBestBuy(env: Env, sku: string, zip: string): Promise<{ stores: BestBuyStore[]; failed: boolean }> {
  const apiKey = env.BESTBUY_API_KEY;
  if (!apiKey) {
    console.warn('[bb enrich] missing BESTBUY_API_KEY');
    return { stores: [], failed: true };
  }
  const radius = Number(env.BB_ENRICHMENT_SEARCH_RADIUS_MILES ?? 50) || 50;
  const area = Math.min(Math.max(radius, 5), 250);
  try {
    const storeUrl = `https://api.bestbuy.com/v1/stores(area(${encodeURIComponent(zip)},${area}))?format=json&show=storeId,name,city,region,lat,lng&apiKey=${encodeURIComponent(apiKey)}`;
    const storeRes = await fetch(storeUrl, { headers: { accept: 'application/json' } });
    if (!storeRes.ok) {
      console.warn('[bb enrich] store lookup failed', storeRes.status);
      return { stores: [], failed: true };
    }
    const storeJson: any = await storeRes.json();
    const storeList: any[] = Array.isArray(storeJson?.stores) ? storeJson.stores : [];

    // Attempt to fetch store availability for the SKU (official API includes InStore availability with store IDs)
    const availUrl = `https://api.bestbuy.com/v1/products(sku=${encodeURIComponent(sku)})?show=sku,storeAvailability&apiKey=${encodeURIComponent(apiKey)}&format=json`;
    const availRes = await fetch(availUrl, { headers: { accept: 'application/json' } });
    let availability: Record<string, boolean> = {};
    if (availRes.ok) {
      const availJson: any = await availRes.json();
      const products: any[] = Array.isArray(availJson?.products) ? availJson.products : [];
      const storeAvail = products[0]?.storeAvailability;
      if (Array.isArray(storeAvail)) {
        for (const entry of storeAvail) {
          const id = entry?.storeId;
          const status = entry?.hasAvailability ?? entry?.hasEnoughInventory;
          if (id) availability[String(id)] = !!status;
        }
      }
    }

    const normalized: BestBuyStore[] = storeList.map((s) => ({
      id: String(s.storeId),
      name: s.name || `Best Buy ${s.city ?? ''}`.trim(),
      city: s.city ?? null,
      state: s.region ?? null,
      zip: s.postalCode ?? zip,
      lat: s.lat != null ? Number(s.lat) : null,
      lng: s.lng != null ? Number(s.lng) : null,
      hasOpenBox: availability[String(s.storeId)] ?? undefined,
    }));

    return { stores: normalized, failed: false };
  } catch (err) {
    console.warn('[bb enrich] fetch error', err);
    return { stores: [], failed: true };
  }
}

export async function getBestBuyStoreAvailability(env: Env, sku: string, zip: string): Promise<StoreAvailability> {
  const cache = await fetchCache(env, sku, zip);
  if (cache?.fresh) {
    return {
      sku,
      zip,
      stores: cache.cache?.stores ?? [],
      refreshedAt: cache.cache?.refreshed_at ?? null,
      fromCache: true,
      failed: cache.cache?.failed ?? false,
    };
  }
  if (cache?.failFresh) {
    return {
      sku,
      zip,
      stores: cache.cache?.stores ?? [],
      refreshedAt: cache.cache?.refreshed_at ?? null,
      fromCache: true,
      failed: true,
    };
  }

  const result = await fetchFromBestBuy(env, sku, zip);
  await saveCache(env, { sku, zip, stores: result.stores, failed: result.failed });

  return {
    sku,
    zip,
    stores: result.stores,
    refreshedAt: new Date().toISOString(),
    fromCache: false,
    failed: result.failed,
  };
}
