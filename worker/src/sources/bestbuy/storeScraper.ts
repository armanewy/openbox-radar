import { parseHTML } from 'linkedom';
import { withRateLimit } from '../../util/rate';
import { classifyProductType } from '../../util/classify';
import type { IngestPayload } from '../../ingest';
import type { StoreConfig } from '../types';
import type { StoreScrapeResult } from '../result';

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

function resolveUrl(href: string, base: string): string | null {
  if (!href) return null;
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

function textFrom(card: any, selectors: string[]): string {
  for (const sel of selectors) {
    const target = card.querySelector(sel);
    if (!target) continue;
    const text = target.textContent?.replace(/\s+/g, ' ').trim();
    if (text) return text;
  }
  return '';
}

function attrFrom(card: any, selectors: string[], attr: string): string {
  for (const sel of selectors) {
    const target = card.querySelector(sel);
    if (!target) continue;
    const value = target.getAttribute(attr)?.trim();
    if (value) return value;
  }
  return '';
}

const BESTBUY_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.6533.89 Safari/537.36';
const BESTBUY_HEADERS = {
  accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'accept-language': 'en-US,en;q=0.9',
  'cache-control': 'no-cache',
  pragma: 'no-cache',
  referer: 'https://www.bestbuy.com/',
  'sec-fetch-dest': 'document',
  'sec-fetch-mode': 'navigate',
  'sec-fetch-site': 'same-origin',
  'upgrade-insecure-requests': '1',
  'user-agent': BESTBUY_USER_AGENT,
} as const;

const RETRYABLE_STATUS = new Set([403, 408, 429, 500, 502, 503, 504, 520, 521, 522]);

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadStoreDocument(url: string, timeoutMs: number) {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: BESTBUY_HEADERS,
        redirect: 'follow',
        signal: controller.signal,
      });
      if (!res.ok) {
        const error = new Error(`Failed to load Best Buy store page: ${res.status} ${res.statusText}`);
        if (attempt < 3 && RETRYABLE_STATUS.has(res.status)) {
          lastError = error;
          await wait(250 * attempt);
          continue;
        }
        throw error;
      }
      const html = await res.text();
      const { document } = parseHTML(html);
      return document;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        const timeoutError = new Error(`Best Buy store page fetch timed out after ${timeoutMs}ms`);
        if (attempt < 3) {
          lastError = timeoutError;
          await wait(250 * attempt);
          continue;
        }
        throw timeoutError;
      }
      if (attempt < 3 && err instanceof Error) {
        lastError = err;
        await wait(250 * attempt);
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError || new Error('Failed to load Best Buy store page after retries');
}

export type BestBuyScrapeOptions = {
  rateLimitMs?: number;
  requestTimeoutMs?: number;
};

export async function scrapeBestBuyStores(
  stores: StoreConfig[],
  options: BestBuyScrapeOptions = {}
): Promise<StoreScrapeResult> {
  if (!stores.length) {
    return { items: [], metrics: [] };
  }

  const rateLimit = options.rateLimitMs ?? 900;
  const requestTimeout = options.requestTimeoutMs ?? 45_000;

  const items: IngestPayload[] = [];
  const metrics: StoreScrapeResult['metrics'] = [];
  const seen = new Set<string>();

  for (const store of stores) {
    const before = items.length;
    const meta = toStoreMeta(store);
    await withRateLimit(async () => {
      const document = await loadStoreDocument(store.url, requestTimeout);
      const cards = Array.from(
        document.querySelectorAll('.sku-item, article.sku-item, li.sku-item, [data-sku-id]'),
      );
      for (const raw of cards) {
        const card = raw as any;
        const skuAttr = attrFrom(card, ['[data-sku-id]'], 'data-sku-id');
        const title = textFrom(card, ['.sku-header a', '.sku-title a', '.sku-title', 'h4 a', 'h4']);
        if (!title) continue;
        const priceText = textFrom(card, ['.priceView-customer-price', '.priceView-hero-price span', '.price']);
        const priceCents = parsePriceToCents(priceText || '');
        if (!priceCents) continue;

        const href = attrFrom(card, ['.sku-header a', '.sku-title a', 'a[href]'], 'href');
        const resolvedUrl = resolveUrl(href, store.url) || store.url;
        const image =
          attrFrom(card, ['img'], 'data-src') ||
          attrFrom(card, ['img'], 'data-original') ||
          attrFrom(card, ['img'], 'src');

        const key = skuAttr ? `${meta.storeId}:${skuAttr}` : `${meta.storeId}:${resolvedUrl}`;
        if (seen.has(key)) continue;
        seen.add(key);

        items.push({
          ...meta,
          sku: skuAttr || undefined,
          title,
          productType: classifyProductType(title),
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

  return { items, metrics };
}
