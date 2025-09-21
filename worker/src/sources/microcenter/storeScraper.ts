import { withRateLimit } from '../../util/rate';
import { classifyProductType } from '../../util/classify';
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

type MicroCenterBrowserFactory = (options: { headless: boolean }) => Promise<Browser>;

function toStoreMeta(store: StoreConfig) {
  return {
    retailer: 'microcenter' as const,
    source: 'microcenter-store',
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

function inferCondition(input: string): string {
  const normalized = input.toLowerCase();
  if (normalized.includes('refurb')) return 'Refurbished';
  if (normalized.includes('clearance')) return 'Clearance';
  if (normalized.includes('demo')) return 'Demo';
  return 'Open-Box';
}

async function extractText(el: any, selectors: string[]): Promise<string> {
  for (const sel of selectors) {
    try {
      const handle = await el.$(sel);
      if (!handle) continue;
      const text = (await handle.textContent())?.replace(/\s+/g, ' ').trim();
      await handle.dispose();
      if (text) return text;
    } catch {}
  }
  return '';
}

async function extractAttribute(el: any, selectors: string[], attr: string): Promise<string> {
  for (const sel of selectors) {
    try {
      const handle = await el.$(sel);
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

function normalizeImage(src: string | null | undefined, base: string): string | undefined {
  if (!src) return undefined;
  const trimmed = src.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  if (/^https?:/i.test(trimmed)) return trimmed;
  try {
    return new URL(trimmed, base).toString();
  } catch {
    return undefined;
  }
}

export type MicroCenterScrapeOptions = {
  headless?: boolean;
  rateLimitMs?: number;
  browserFactory?: MicroCenterBrowserFactory;
};

async function ensureBrowser(options: MicroCenterScrapeOptions): Promise<Browser> {
  const headless = options.headless !== false;
  if (typeof options.browserFactory === 'function') {
    return options.browserFactory({ headless });
  }

  const globalFactory = (globalThis as any).__MICROCENTER_BROWSER_FACTORY__ as
    | MicroCenterBrowserFactory
    | undefined;
  if (typeof globalFactory === 'function') {
    return globalFactory({ headless });
  }

  let importError: unknown;
  if (typeof process !== 'undefined' && process.versions?.node) {
    try {
      const playwright = await import('playwright-core');
      if (playwright?.chromium?.launch) {
        return playwright.chromium.launch({ headless });
      }
    } catch (err) {
      importError = err;
    }
  }

  const baseMessage =
    'Micro Center store scraping requires a browserFactory that supplies a Playwright-compatible browser. ' +
    'Provide options.browserFactory or set globalThis.__MICROCENTER_BROWSER_FACTORY__ before enabling this source.';

  if (importError) {
    const details = importError instanceof Error ? importError.message : String(importError);
    throw new Error(`${baseMessage} Attempted to import playwright-core but failed: ${details}`);
  }

  throw new Error(`${baseMessage} Install playwright-core to use the default chromium launcher.`);
}

export async function scrapeMicroCenterStores(
  stores: StoreConfig[],
  options: MicroCenterScrapeOptions = {}
): Promise<StoreScrapeResult> {
  if (!stores.length) {
    return { items: [], metrics: [] };
  }

  const rateLimit = options.rateLimitMs ?? 1000;
  const browser = await ensureBrowser(options);
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
        const cards = await page.$$('.product_wrapper, .product, .product_tile, .productGrid .product, li.product, article');
        for (const card of cards) {
          const title = await extractText(card, ['.product_title', '.details .name', '.product_name', '.productTitle', 'a']);
          if (!title) continue;
          const priceText = await extractText(card, ['.price', '.price .value', '[class*="price"]', '.price-wrapper']);
          const priceCents = parsePriceToCents(priceText);
          if (!priceCents) continue;

          const href = await extractAttribute(card, ['a[href*="/product/"]', 'a[href]'], 'href');
          const resolvedUrl = resolveUrl(href, store.url) || store.url;
          const imageSrcset = await extractAttribute(card, ['img'], 'srcset');
          const imageCandidate =
            (await extractAttribute(card, ['img'], 'data-src')) ||
            (await extractAttribute(card, ['img'], 'data-original')) ||
            (imageSrcset ? imageSrcset.split(' ')[0] : '') ||
            (await extractAttribute(card, ['img'], 'src'));

          const key = `${meta.storeId}:${resolvedUrl}`;
          if (seen.has(key)) continue;
          seen.add(key);

          const conditionText =
            (await extractText(card, ['.product_condition', '.condition', '.productCondition', '.product_promo'])) || title;

          items.push({
            ...meta,
            title,
            productType: classifyProductType(title),
            priceCents,
            conditionLabel: inferCondition(conditionText),
            url: resolvedUrl,
            seenAt: new Date().toISOString(),
            imageUrl: normalizeImage(imageCandidate, resolvedUrl),
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
