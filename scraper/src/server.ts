import Fastify from 'fastify';
import cors from '@fastify/cors';
import { chromium } from 'playwright';

const SECRET = process.env.SCRAPER_SECRET!;
const app = Fastify({ logger: true });
await app.register(cors, { origin: false });

function auth(req: any) {
  const got = req.headers['x-scrape-secret'];
  if (!SECRET || got !== SECRET) throw new Error('unauthorized');
}

type Store = { id: string; name: string; city?: string; state?: string; url: string };
type Item = {
  source: 'bestbuy-store' | 'microcenter-store';
  channel: 'store';
  confidence: 'scrape';
  retailer_store_id: string;
  retailer_store_name?: string;
  retailer_store_city?: string;
  retailer_store_state?: string;
  sku?: string;
  title: string;
  product_type?: string;
  condition: 'OPEN_BOX' | 'CLEARANCE' | 'REFURB';
  price_cents: number;
  url: string;
  image_url?: string;
  last_seen_at: string;
};

const parsePrice = (s: string) => {
  const m = s.replace(/[, ]/g, '').match(/\$?(\d+(?:\.\d{1,2})?)/);
  return m ? Math.round(parseFloat(m[1]) * 100) : 0;
};

const classify = (title: string): string => {
  const t = title.toLowerCase();
  if (/\b(tv|oled|qled|uhd|4k|8k|the frame)\b/.test(t)) return 'TV';
  if (/\b(monitor|ultrawide|display|curved)\b/.test(t)) return 'MONITOR';
  if (/\b(laptop|notebook|macbook|chromebook)\b/.test(t)) return 'LAPTOP';
  if (/\b(rtx|gtx|radeon|graphics\s?card|rx\s?\d{3,4})\b/.test(t)) return 'GPU';
  if (/\b(ps5|xbox|nintendo\s?switch)\b/.test(t)) return 'CONSOLE';
  return 'OTHER';
};

async function scrapeWith(page: any, store: Store, grab: () => Promise<Item[]>) {
  const t0 = Date.now();
  const items = await grab();
  app.log.info({ store: store.id, count: items.length, ms: Date.now() - t0 }, 'scrape_done');
  return items;
}

app.post('/scrape/microcenter-store', async (req, reply) => {
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
  try {
    auth(req);
    const { stores } = req.body as { stores: Store[] };
    if (!Array.isArray(stores) || stores.length === 0) {
      return reply.code(400).send({ error: 'stores array required' });
    }
    browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    const batch: Item[] = [];
    for (const store of stores) {
      const items = await scrapeWith(page, store, async () => {
        await page.goto(store.url, { waitUntil: 'domcontentloaded', timeout: 45_000 });

        const cards = await page.$$('section, li, .productWrapper, .product');
        const results: Item[] = [];
        for (const el of cards) {
          const title = (
            await el
              .$eval('a, h3, .productTitle', (n) => n.textContent || '')
              .catch(() => '')
          )?.trim();
          if (!title) continue;
          const priceTxt = await el
            .$eval('.price, .finalPrice, [data-price]', (n) => n.textContent || '')
            .catch(() => '');
          const url = await el
            .$eval('a', (a: any) => a.href)
            .catch(() => store.url);
          const img = await el
            .$eval('img', (i: any) => i.src)
            .catch(() => undefined);

          results.push({
            source: 'microcenter-store',
            channel: 'store',
            confidence: 'scrape',
            retailer_store_id: store.id,
            retailer_store_name: store.name,
            retailer_store_city: store.city,
            retailer_store_state: store.state,
            title,
            product_type: classify(title),
            condition: /open box/i.test(title)
              ? 'OPEN_BOX'
              : /refurb/i.test(title)
              ? 'REFURB'
              : 'CLEARANCE',
            price_cents: parsePrice(priceTxt),
            url,
            image_url: img,
            last_seen_at: new Date().toISOString(),
          });
        }
        return results;
      });

      batch.push(...items);
    }

    return reply.send(batch);
  } catch (e: any) {
    req.log.error(e);
    return reply.code(500).send({ error: e.message });
  } finally {
    await browser?.close().catch(() => {});
  }
});

app.post('/scrape/bestbuy-store', async (req, reply) => {
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
  try {
    auth(req);
    const { stores } = req.body as { stores: Store[] };
    if (!Array.isArray(stores) || stores.length === 0) {
      return reply.code(400).send({ error: 'stores array required' });
    }
    browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    const batch: Item[] = [];
    for (const store of stores) {
      const items = await scrapeWith(page, store, async () => {
        await page.goto(store.url, { waitUntil: 'domcontentloaded', timeout: 45_000 });

        const cards = await page.$$('.sku-item, article, li');
        const results: Item[] = [];
        for (const el of cards) {
          const title = (
            await el
              .$eval('.sku-header a, h3, a', (n) => n.textContent || '')
              .catch(() => '')
          )?.trim();
          if (!title) continue;
          const url = await el
            .$eval('.sku-header a, a', (a: any) => a.href)
            .catch(() => store.url);
          const priceTxt = await el
            .$eval('.priceView-customer-price, .price', (n) => n.textContent || '')
            .catch(() => '');
          const img = await el
            .$eval('img', (i: any) => i.src)
            .catch(() => undefined);
          const sku = await el
            .getAttribute('data-sku-id')
            .catch(() => undefined as any);

          results.push({
            source: 'bestbuy-store',
            channel: 'store',
            confidence: 'scrape',
            retailer_store_id: store.id,
            retailer_store_name: store.name,
            retailer_store_city: store.city,
            retailer_store_state: store.state,
            sku: typeof sku === 'string' && sku ? sku : undefined,
            title,
            product_type: classify(title),
            condition: 'OPEN_BOX',
            price_cents: parsePrice(priceTxt),
            url,
            image_url: img,
            last_seen_at: new Date().toISOString(),
          });
        }
        return results;
      });

      batch.push(...items);
    }

    return reply.send(batch);
  } catch (e: any) {
    req.log.error(e);
    return reply.code(500).send({ error: e.message });
  } finally {
    await browser?.close().catch(() => {});
  }
});

const port = process.env.PORT ? Number(process.env.PORT) : 3000;
app
  .listen({ port, host: '0.0.0.0' })
  .then(() => app.log.info(`scraper listening on :${port}`));
