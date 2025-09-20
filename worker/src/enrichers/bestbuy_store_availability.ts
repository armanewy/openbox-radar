type Env = { [key: string]: string | undefined };

export type BestBuyStore = {
  id: string;
  name: string;
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

async function fetchFromBestBuy(_env: Env, _sku: string, _zip: string): Promise<{ stores: BestBuyStore[]; failed: boolean }> {
  // TODO: integrate official Best Buy store availability APIs.
  // Placeholder returns empty list (treat as failure so cache refresh retry occurs later).
  return { stores: [], failed: true };
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

