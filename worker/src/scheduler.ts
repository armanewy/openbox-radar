import { fetchBestBuyStore, fetchMicroCenterStore } from "./adapters/stubs";
import { fetchMicroCenterOpenBoxDOM } from "./adapters/microcenter_dom";
import { fetchBestBuyOpenBoxBySkus, fetchBestBuyOpenBoxByCategory } from "./adapters/bestbuy_api";

export const Scheduler = {
  async run(env: any) {
    // TODO: query active watches/store list via Supabase REST or KV; for now, static examples
    const useRealMC = env.USE_REAL_MICROCENTER === '1';
    const useRealBBY = env.USE_REAL_BESTBUY === '1';

    const mcPromise = useRealMC
      ? fetchMicroCenterOpenBoxDOM('mc-cambridge')
      : fetchMicroCenterStore('mc-cambridge');

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
      bbyPromise = fetchBestBuyStore('bby-123');
    }

    const batches = await Promise.all([bbyPromise, mcPromise]);

    const items = batches.flatMap((b) => b.items);
    if (items.length === 0) return { ok: true, ingested: 0 };

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
      return { ok: r.ok, status: r.status, ingested: json.inserted ?? 0 };
    } catch (e: any) {
      return { ok: false, error: e?.message || String(e), step: 'ingest', ingestUrl };
    }
  }
}
