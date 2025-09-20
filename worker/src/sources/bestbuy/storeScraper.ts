import { withRateLimit } from '../../util/rate';
import type { IngestPayload } from '../../ingest';
import type { StoreConfig } from '../types';
import type { StoreScrapeResult } from '../result';

type Browser = {
  newContext(options?: any): Promise<BrowserContext>;
  close(): Promise<void>;
};

type BrowserContext = {
  newPage(): Promise<Page>;
  close(): Promise<void>;
};

type Page = {
  goto(url: string, options?: Record<string, any>): Promise<void>;
  $$(selector: string): Promise<any[]>;
  close(): Promise<void>;
};

async function loadChromium() {
  try {
    const mod: any = await import('playwright-core');
    if (mod?.chromium?.launch) return mod.chromium;
  } catch (err) {
    console.warn('[bestbuy] playwright-core not available', err);
  }
  throw new Error(
    'playwright-core is required to scrape Best Buy store pages. Install it in the worker package before enabling this source.'
  );
}

function toStoreMeta(store: StoreConfig) {
  return {
    retailer: 'bestbuy' as const,
    source: 'bestbuy-store',
    channel: 'store',
    confidence: 'scrape',
    storeId: store.id,
    storeName: store.name,
    storeCity: store.city,
    storeState: store.state,
  };
}

function parsePriceToCents(text: string): number | null {
  const cleaned = text.replace(/[,\s]/g, '');
  const match = cleaned.match(/\$?(\d+(?:\.\d{1,2})?)/);
  if (!match) return null;
  return Math.round(parseFloat(match[1]) * 100);
}

async function ensureBrowser(headless: boolean): Promise<Browser> {
  const chromium = await loadChromium();
  return chromium.launch({ headless });
}

async function textFrom(card: any, selectors: string[]): Promise<string> {
  for (const sel of selectors) {
    try {
      const handle = await card.$(sel);
      if (!handle) continue;
      const text = (await handle.textContent())?.replace(/\s+/g, ' ').trim();
      await handle.dispose();
      if (text) return text;
    } catch {}
  }
  return '';
}

async function attrFrom(card: any, selectors: string[], attr: string): Promise<string> {
  for (const sel of selectors) {
    try {
      const handle = await card.$(sel);
      if (!handle) continue;
      const value = await handle.getAttribute(attr);
      await handle.dispose();
      if (value && value.trim()) return value.trim();
    } catch {}
  }
  return '';
}

function resolveUrl(href: string, base: string): string | null {
  if (!href) return null;
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

export type BestBuyScrapeOptions = {
  headless?: boolean;
  rateLimitMs?: number;
};

export async function scrapeBestBuyStores(
  stores: StoreConfig[],
  options: BestBuyScrapeOptions = {}
): Promise<StoreScrapeResult> {
  if (!stores.length) {
    return { items: [], metrics: [] };
  }

  const headless = options.headless !== false;
  const rateLimit = options.rateLimitMs ?? 900;
  const browser = await ensureBrowser(headless);
  const context = await browser.newContext();
  const page = await context.newPage();

  const items: IngestPayload[] = [];
  const metrics: StoreScrapeResult['metrics'] = [];
  const seen = new Set<string>();

  try {
    for (const store of stores) {
      const before = items.length;
      const meta = toStoreMeta(store);
      await withRateLimit(async () => {
        await page.goto(store.url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
        const cards = await page.$$('.sku-item, article.sku-item, li.sku-item, article');
        for (const card of cards) {
          const skuAttr = await attrFrom(card, ['[data-sku-id]'], 'data-sku-id');
          const title = await textFrom(card, ['.sku-header a', '.sku-title a', '.sku-title', 'h4 a', 'h4']);
          if (!title) continue;
          const priceText = await textFrom(card, ['.priceView-customer-price', '.priceView-hero-price span', '.price']);
          const priceCents = parsePriceToCents(priceText || '');
          if (!priceCents) continue;

          const href = await attrFrom(card, ['.sku-header a', '.sku-title a', 'a[href]'], 'href');
          const resolvedUrl = resolveUrl(href, store.url) || store.url;
          const image =
            (await attrFrom(card, ['img'], 'data-src')) ||
            (await attrFrom(card, ['img'], 'data-original')) ||
            (await attrFrom(card, ['img'], 'src'));

          const key = skuAttr ? `${meta.storeId}:${skuAttr}` : `${meta.storeId}:${resolvedUrl}`;
          if (seen.has(key)) continue;
          seen.add(key);

          items.push({
            ...meta,
            sku: skuAttr || undefined,
            title,
            priceCents,
            conditionLabel: 'Open-Box',
            url: resolvedUrl,
            seenAt: new Date().toISOString(),
            imageUrl: image,
          });
        }
      }, rateLimit);

      metrics.push({ storeId: store.id, count: items.length - before, url: store.url });
    }
  } finally {
    await page.close();
    await context.close();
    await browser.close();
  }

  return { items, metrics };
}
