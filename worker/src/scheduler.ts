import { fetchBestBuyStore, fetchMicroCenterStore } from "./adapters/stubs";
import { fetchMicroCenterOpenBoxDOM } from "./adapters/microcenter_dom";
import { fetchBestBuyOpenBoxBySkus, fetchBestBuyOpenBoxByCategory } from "./adapters/bestbuy_api";
import { fetchNeweggClearance } from "./adapters/newegg_clearance";

export const Scheduler = {
  async run(env: any) {
    // Flags
    const useRealMC = env.USE_REAL_MICROCENTER === '1';
    const useRealBBY = env.USE_REAL_BESTBUY === '1';
    const allowDevStubs = env.ALLOW_DEV_STUBS === '1';

    // Micro Center
    const mcPromise = useRealMC
      ? fetchMicroCenterOpenBoxDOM('mc-cambridge')
      : (allowDevStubs ? fetchMicroCenterStore('mc-cambridge') : Promise.resolve({ storeId: 'mc-disabled', items: [] as any[] }));

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

    const useRealNE = env.USE_REAL_NEWEGG === '1';
    const nePromise = fetchNeweggClearance(useRealNE);

    const batches = await Promise.all([bbyPromise, mcPromise, nePromise]);

    const items = batches.flatMap((b) => b.items);
    const sources = batches.map((b) => ({ storeId: (b as any)?.storeId || 'unknown', count: b.items?.length ?? 0 }));
    console.log('[scheduler] flags:', { useRealBBY, useRealMC, allowDevStubs });
    console.log('[scheduler] adapter batches:', sources.map((s) => `${s.storeId}:${s.count}`).join(', '));
    if (items.length === 0) return { ok: true, ingested: 0, flags: { useRealBBY, useRealMC, allowDevStubs }, sources } as any;

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
      return { ok: r.ok, status: r.status, ingested: json.inserted ?? 0, flags: { useRealBBY, useRealMC, allowDevStubs }, sources } as any;
    } catch (e: any) {
      return { ok: false, error: e?.message || String(e), step: 'ingest', ingestUrl, flags: { useRealBBY, useRealMC, allowDevStubs }, sources } as any;
    }
  }
}
