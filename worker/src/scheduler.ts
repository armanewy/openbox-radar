import { fetchBestBuyStore, fetchMicroCenterStore } from './adapters/stubs';
import { fetchBestBuyOpenBoxBySkus, fetchBestBuyOpenBoxByCategory } from './adapters/bestbuy_api';
import { fetchMicroCenterOpenBoxDOM } from './adapters/microcenter_dom';
import { fetchNeweggClearance } from './adapters/newegg_clearance';
import { getBestBuyStoreAvailability } from './enrichers/bestbuy_store_availability';
import { scrapeMicroCenterStores } from './sources/microcenter/storeScraper';
import { scrapeBestBuyStores } from './sources/bestbuy/storeScraper';
import type { StoreConfig } from './sources/types';
import { postIngest, type IngestPayload } from './ingest';
import { classifyProductType } from './util/classify';

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

function titleCase(input: string): string {
  return input
    .split(' ')
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : ''))
    .join(' ')
    .trim();
}

function buildMicroCenterStore(id: string): StoreConfig {
  const slug = id.replace(/^mc-/, '');
  const label = slug.replace(/-/g, ' ');
  return {
    id,
    name: titleCase(`Micro Center ${label || id}`),
    url: `https://www.microcenter.com/site/stores/${slug}-open-box.aspx`,
  };
}

function buildBestBuyStore(id: string): StoreConfig {
  const numeric = id.replace(/^bby-/, '');
  return {
    id,
    name: `Best Buy ${numeric}`,
    url: `https://www.bestbuy.com/site/searchpage.jsp?st=open+box&cp=1&qp=storepickupsameasstoreid_facet%3DStorePickUpSameAsStoreId_facet%3D${numeric}`,
  };
}

function parseStoreConfigs(
  raw: string | undefined,
  fallback: string[],
  builder: (id: string) => StoreConfig
): StoreConfig[] {
  const entries = (raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const source = entries.length ? entries : fallback;
  return source.map((entry) => {
    const [meta, urlOverride] = entry.split('@');
    const parts = meta
      .split('|')
      .map((s) => s.trim())
      .filter(Boolean);
    const id = parts[0];
    const store = builder(id);
    if (parts[1]) store.name = parts[1];
    if (parts[2]) store.city = parts[2];
    if (parts[3]) store.state = parts[3];
    if (urlOverride) store.url = urlOverride.trim();
    return store;
  });
}

function mapLegacyItems(items: any[], meta: Partial<IngestPayload>): IngestPayload[] {
  return items
    .map((item) => {
      if (!item) return null;
      const seenAt = item.seenAt || new Date().toISOString();
      const condition = item.conditionLabel || meta.conditionLabel || 'Open-Box';
      return {
        retailer: item.retailer || meta.retailer || 'unknown',
        storeId: item.storeId || meta.storeId || 'unknown',
        sku: item.sku || undefined,
        title: item.title,
        productType: classifyProductType(item.title),
        conditionLabel: condition,
        priceCents: item.priceCents,
        url: item.url,
        seenAt,
        imageUrl: item.imageUrl,
        source: meta.source,
        channel: meta.channel,
        confidence: meta.confidence,
        storeName: meta.storeName,
        storeCity: meta.storeCity,
        storeState: meta.storeState,
      } satisfies IngestPayload;
    })
    .filter(Boolean) as IngestPayload[];
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
    const allowDevStubs = env.ALLOW_DEV_STUBS === '1';
    const enableMicroCenterStore = env.ENABLE_MC_STORE_SCRAPE === '1';
    const enableBestBuyStore = env.ENABLE_BB_STORE_SCRAPE === '1';
    const useBestBuyApi = env.USE_REAL_BESTBUY === '1';
    const useMicroCenterDom = env.USE_REAL_MICROCENTER === '1';
    const useNewegg = env.USE_REAL_NEWEGG === '1';

    const headless = env.PLAYWRIGHT_HEADLESS !== '0';
    const ingestItems: IngestPayload[] = [];
    const sources: Array<{ storeId: string; count: number; url?: string }> = [];

    // Micro Center store scrape
    if (enableMicroCenterStore) {
      const stores = parseStoreConfigs(env.MICROCENTER_STORE_IDS, ['mc-cambridge'], buildMicroCenterStore);
      const mcResult = await scrapeMicroCenterStores(stores, {
        headless,
        rateLimitMs: Number(env.MICROCENTER_RATE_LIMIT_MS || '1000'),
      }).catch((err) => {
        console.warn('[scheduler] microcenter scrape failed', err);
        return { items: [], metrics: [] };
      });
      ingestItems.push(...mcResult.items);
      mcResult.metrics.forEach((m) => sources.push({ storeId: m.storeId, count: m.count, url: m.url }));
    } else if (useMicroCenterDom) {
      const storeIds = parseStoreConfigs(env.MICROCENTER_STORE_IDS, ['mc-cambridge'], buildMicroCenterStore);
      for (const store of storeIds) {
        try {
          const batch = await fetchMicroCenterOpenBoxDOM(store.id);
          ingestItems.push(
            ...mapLegacyItems(batch.items, {
              source: 'microcenter-dom',
              channel: 'store',
              confidence: 'scrape',
              retailer: 'microcenter',
              storeId: store.id,
              storeName: store.name,
              storeCity: store.city,
              storeState: store.state,
            })
          );
          sources.push({ storeId: store.id, count: batch.items.length });
        } catch (err) {
          console.warn('[scheduler] microcenter dom fallback failed', store.id, err);
        }
      }
    } else if (allowDevStubs) {
      const stub = await fetchMicroCenterStore('mc-cambridge');
      ingestItems.push(
        ...mapLegacyItems(stub.items, {
          source: 'microcenter-stub',
          channel: 'store',
          confidence: 'heuristic',
        })
      );
      sources.push({ storeId: 'mc-cambridge', count: stub.items.length });
    }

    // Best Buy store scrape
    if (enableBestBuyStore) {
      const stores = parseStoreConfigs(env.BESTBUY_STORE_IDS, ['bby-123'], buildBestBuyStore);
      const bbResult = await scrapeBestBuyStores(stores, {
        rateLimitMs: Number(env.BESTBUY_RATE_LIMIT_MS || '900'),
      }).catch((err) => {
        console.warn('[scheduler] bestbuy store scrape failed', err);
        return { items: [], metrics: [] };
      });
      ingestItems.push(...bbResult.items);
      bbResult.metrics.forEach((m) => sources.push({ storeId: m.storeId, count: m.count, url: m.url }));
    } else if (useBestBuyApi) {
      const apiKey: string = env.BESTBUY_API_KEY || '';
      const skus = String(env.BESTBUY_SKUS || '')
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);
      const categories = String(env.BESTBUY_CATEGORIES || '')
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);
      const includeKeywords = String(env.BESTBUY_INCLUDE_KEYWORDS || '')
        .toLowerCase()
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);
      const excludeKeywords = String(env.BESTBUY_EXCLUDE_KEYWORDS || '')
        .toLowerCase()
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);
      const pageSize = Number(env.BESTBUY_PAGE_SIZE || 50);
      const seenKeys = new Set<string>();
      const collected: any[] = [];

      const matchesKeywords = (title: string | undefined | null) => {
        const t = (title || '').toLowerCase();
        if (!t) return includeKeywords.length === 0;
        if (excludeKeywords.some((k) => t.includes(k))) return false;
        if (includeKeywords.length && !includeKeywords.some((k) => t.includes(k))) return false;
        return true;
      };

      const consider = (items: any[]) => {
        for (const item of items) {
          if (!item || !matchesKeywords(item.title)) continue;
          const key = item.sku ? item.sku : item.url;
          if (!key || seenKeys.has(key)) continue;
          seenKeys.add(key);
          collected.push(item);
        }
      };

      try {
        if (skus.length) {
          const result = await fetchBestBuyOpenBoxBySkus(apiKey, skus);
          consider(result.items);
        }

        const queryTargets = categories.length ? categories : ['*'];
        for (const categoryId of queryTargets) {
          const result = await fetchBestBuyOpenBoxByCategory(apiKey, categoryId as any, pageSize);
          consider(result.items);
        }
      } catch (err) {
        console.warn('[scheduler] bestbuy api fetch failed', err);
      }

      if (collected.length) {
        ingestItems.push(
          ...mapLegacyItems(collected, {
            source: 'bestbuy-online',
            channel: 'online',
            confidence: 'api',
          })
        );
        sources.push({ storeId: 'bby-online', count: collected.length });
      }
    } else if (allowDevStubs) {
      const stub = await fetchBestBuyStore('bby-123');
      ingestItems.push(
        ...mapLegacyItems(stub.items, {
          source: 'bestbuy-stub',
          channel: 'store',
          confidence: 'heuristic',
        })
      );
      sources.push({ storeId: 'bby-123', count: stub.items.length });
    }

    // Newegg open-box scrape
    const neweggBatch = await fetchNeweggClearance(useNewegg).catch((err) => {
      console.warn('[scheduler] newegg fetch failed', err);
      return { storeId: 'newegg-online', items: [] as any[] };
    });
    ingestItems.push(
      ...mapLegacyItems(neweggBatch.items, {
        source: neweggBatch.storeId,
        channel: 'online',
        confidence: useNewegg ? 'scrape' : 'heuristic',
      })
    );
    sources.push({ storeId: neweggBatch.storeId, count: neweggBatch.items.length });

    const enrichment = await refreshBestBuyForHotWatches(env);

    if (!ingestItems.length) {
      return {
        ok: true,
        ingested: 0,
        flags: {
          enableMicroCenterStore,
          enableBestBuyStore,
          useBestBuyApi,
          useMicroCenterDom,
          useNewegg,
          allowDevStubs,
        },
        sources,
        enrichment,
      } as any;
    }

    try {
      const ingestResult = await postIngest(ingestItems, {
        ingestUrl: env.INGEST_URL,
        secret: env.CRON_SHARED_SECRET,
      });
      return {
        ok: true,
        ingested: ingestResult.inserted,
        status: ingestResult.status,
        flags: {
          enableMicroCenterStore,
          enableBestBuyStore,
          useBestBuyApi,
          useMicroCenterDom,
          useNewegg,
          allowDevStubs,
        },
        sources,
        enrichment,
      } as any;
    } catch (err: any) {
      return {
        ok: false,
        error: err?.message || String(err),
        step: 'ingest',
        flags: {
          enableMicroCenterStore,
          enableBestBuyStore,
          useBestBuyApi,
          useMicroCenterDom,
          useNewegg,
          allowDevStubs,
        },
        sources,
        enrichment,
      } as any;
    }
  },
};
