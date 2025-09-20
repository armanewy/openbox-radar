import { fetchBestBuyStore, fetchMicroCenterStore } from "./adapters/stubs";
import { fetchMicroCenterOpenBoxDOM } from "./adapters/microcenter_dom";
import { fetchBestBuyOpenBoxBySkus, fetchBestBuyOpenBoxByCategory } from "./adapters/bestbuy_api";
import { fetchNeweggClearance } from "./adapters/newegg_clearance";
import { getBestBuyStoreAvailability } from "./enrichers/bestbuy_store_availability";

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

async function refreshBestBuyForHotWatches(env: any) {
  if (env.ENABLE_BB_ENRICHMENT !== '1') return [] as any[];
  const base = baseUrlFromIngest(env.INGEST_URL || '');
  if (!base) return [];
  const auth = env.CRON_SHARED_SECRET ? { authorization: `Bearer ${env.CRON_SHARED_SECRET}` } : {};
  try {
    const res = await fetch(`${base}/api/alerts/watches`, { headers: { ...auth } });
    if (!res.ok) return [];
    const data: any = await res.json();
    const watches: any[] = data?.watches || [];
    const seen = new Set<string>();
    const refreshed: Array<{ sku: string; zip: string; fromCache: boolean }> = [];
    for (const w of watches) {
      if ((w.retailer as string)?.toLowerCase() !== 'bestbuy') continue;
      const sku = w.sku || w.product_url?.split('/').pop();
      const zip = w.zipcode;
      if (!sku || !zip) continue;
      const key = `${sku}:${zip}`;
      if (seen.has(key)) continue;
      seen.add(key);
      try {
        const result = await getBestBuyStoreAvailability(env, sku, zip);
        refreshed.push({ sku, zip, fromCache: result.fromCache });
      } catch (err) {
        console.warn('[scheduler] bb enrich refresh failed', sku, zip, err);
      }
    }
    return refreshed;
  } catch (err) {
    console.warn('[scheduler] fetch watches for enrichment failed', err);
    return [];
  }
}

export const Scheduler = {
  async run(env: any) {
    // Flags
    const useRealMC = env.USE_REAL_MICROCENTER === '1';
    const useRealBBY = env.USE_REAL_BESTBUY === '1';
    const allowDevStubs = env.ALLOW_DEV_STUBS === '1';

    const adapterPromises: Array<Promise<{ storeId: string; items: any[] }>> = [];

    // Micro Center
    if (useRealMC) {
      const rawStoreIds = String(env.MICROCENTER_STORE_IDS || 'mc-cambridge')
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);
      const storeIds = rawStoreIds.length ? rawStoreIds : ['mc-cambridge'];
      for (const id of storeIds) {
        adapterPromises.push(
          fetchMicroCenterOpenBoxDOM(id).catch((err) => {
            console.warn('[scheduler] microcenter fetch failed', id, err);
            return { storeId: id, items: [] as any[] };
          })
        );
      }
    } else if (allowDevStubs) {
      adapterPromises.push(fetchMicroCenterStore('mc-cambridge'));
    }

    let bbyPromise: Promise<{ storeId: string; items: any[] }>;
    if (useRealBBY) {
      const apiKey: string = env.BESTBUY_API_KEY || '';
      const skus = String(env.BESTBUY_SKUS || '')
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);
      const category: string = env.BESTBUY_CATEGORY || '';
      if (skus.length) {
        bbyPromise = fetchBestBuyOpenBoxBySkus(apiKey, skus);
      } else if (category) {
        bbyPromise = fetchBestBuyOpenBoxByCategory(apiKey, category, Number(env.BESTBUY_PAGE_SIZE || 50));
      } else {
        // No inputs provided; return empty
        bbyPromise = Promise.resolve({ storeId: 'bby-online', items: [] });
      }
    } else {
      bbyPromise = allowDevStubs ? fetchBestBuyStore('bby-123') : Promise.resolve({ storeId: 'bby-disabled', items: [] });
    }
    adapterPromises.push(bbyPromise);

    const useRealNE = env.USE_REAL_NEWEGG === '1';
    adapterPromises.push(
      fetchNeweggClearance(useRealNE).catch((err) => {
        console.warn('[scheduler] newegg fetch failed', err);
        return { storeId: 'newegg-online', items: [] as any[] };
      })
    );

    const enrichment = await refreshBestBuyForHotWatches(env);

    const batches = await Promise.all(adapterPromises);

    const items = batches.flatMap((b) => b.items);
    const sources = batches.map((b) => ({ storeId: (b as any)?.storeId || 'unknown', count: b.items?.length ?? 0 }));
    console.log('[scheduler] flags:', { useRealBBY, useRealMC, useRealNE, allowDevStubs });
    console.log('[scheduler] adapter batches:', sources.map((s) => `${s.storeId}:${s.count}`).join(', '));
    if (items.length === 0) return { ok: true, ingested: 0, flags: { useRealBBY, useRealMC, useRealNE, allowDevStubs }, sources } as any;

    const ingestUrl: string = env.INGEST_URL || '';
    if (!ingestUrl) return { ok: false, error: 'INGEST_URL not set', ingested: 0 };

    try {
      const r = await fetch(ingestUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': `Bearer ${env.CRON_SHARED_SECRET}`,
        },
        body: JSON.stringify({ items }),
      });

      const json = await r.json().catch(() => ({}));
      return { ok: r.ok, status: r.status, ingested: json.inserted ?? 0, flags: { useRealBBY, useRealMC, useRealNE, allowDevStubs }, sources, enrichment } as any;
    } catch (e: any) {
      return { ok: false, error: e?.message || String(e), step: 'ingest', ingestUrl, flags: { useRealBBY, useRealMC, useRealNE, allowDevStubs }, sources, enrichment } as any;
    }
  }
}
