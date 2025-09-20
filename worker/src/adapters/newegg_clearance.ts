import { parseHTML } from 'linkedom';
import type { NormalizedItem } from './types';

const STORE_ID = 'newegg-online';
const LISTING_URL = 'https://www.newegg.com/d/Open-Box?PageSize=96';
const USER_AGENT = 'Mozilla/5.0 (compatible; OpenboxRadar/0.4; +https://openboxradar.com)';

function parsePriceToCents(text: string): number | null {
  const cleaned = text.replace(/[\s,$]/g, '').replace(/\.([0-9])$/, '.$10');
  const match = cleaned.match(/(\d+)(?:\.(\d{2}))?/);
  if (!match) return null;
  const dollars = Number(match[1]);
  const cents = match[2] ? Number(match[2]) : 0;
  if (Number.isNaN(dollars) || Number.isNaN(cents)) return null;
  return dollars * 100 + cents;
}

function normalizeImage(url: string | null | undefined, base: string): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  if (/^https?:/i.test(trimmed)) return trimmed;
  try {
    return new URL(trimmed, base).toString();
  } catch {}
  return undefined;
}

function parseSkuFromUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    const fromQuery = url.searchParams.get('Item') || url.searchParams.get('item');
    if (fromQuery) return fromQuery;
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length) {
      const last = parts[parts.length - 1];
      const skuMatch = last.match(/(N[0-9A-Z]{2,})/i);
      if (skuMatch?.[1]) return skuMatch[1].toUpperCase();
    }
  } catch {}
  return null;
}

export async function fetchNeweggClearance(useReal: boolean): Promise<{ storeId: string; items: NormalizedItem[] }> {
  if (!useReal) {
    return { storeId: STORE_ID, items: [] };
  }

  const now = new Date().toISOString();
  const items: NormalizedItem[] = [];
  const seen = new Set<string>();

  try {
    const res = await fetch(LISTING_URL, {
      headers: {
        'user-agent': USER_AGENT,
        'accept-language': 'en-US,en;q=0.9',
      },
    });
    if (!res.ok) {
      console.warn('[newegg] listing fetch failed', res.status, res.statusText);
      return { storeId: STORE_ID, items: [] };
    }

    const html = await res.text();
    const { document } = parseHTML(html);

    const cards = document.querySelectorAll(
      '.item-cell, .swiper-slide .item-cell, .item-container, .item-content, .slick-slide .item-cell'
    );

    for (const card of cards as any) {
      const link = card.querySelector('a.item-title') || card.querySelector('a[href*="/Product/"]');
      const href = link?.getAttribute('href');
      const title = (link?.textContent || '').trim();
      if (!href || !title) continue;

      const priceEl =
        card.querySelector('.price-current') ||
        card.querySelector('.price') ||
        card.querySelector('[class*="price"][class*="current"]');
      let priceText = (priceEl?.textContent || '').trim();
      if (!priceText) {
        const strong = card.querySelector('.price-current strong');
        const sup = card.querySelector('.price-current sup');
        if (strong) {
          priceText = `${strong.textContent || ''}${sup?.textContent || ''}`;
        }
      }
      let priceCents = parsePriceToCents(priceText);
      if (priceCents == null) {
        const dollarsText = (card.querySelector('.price-current strong')?.textContent || '').replace(/[^0-9]/g, '');
        const centsRaw = (card.querySelector('.price-current sup')?.textContent || '').replace(/[^0-9]/g, '');
        if (dollarsText) {
          const centsPart = centsRaw ? centsRaw.padEnd(2, '0').slice(0, 2) : '00';
          priceCents = Number(dollarsText) * 100 + Number(centsPart);
        }
      }
      if (priceCents == null || Number.isNaN(priceCents)) continue;

      const absoluteUrl = new URL(href, LISTING_URL).toString();
      const sku = parseSkuFromUrl(absoluteUrl);
      const key = sku || absoluteUrl;
      if (seen.has(key)) continue;
      seen.add(key);

      const condition =
        (card.querySelector('.item-promo')?.textContent ||
          card.querySelector('[class*="promo"]')?.textContent ||
          card.querySelector('.item-operating-condition')?.textContent ||
          'Open-Box')
          .replace(/\s+/g, ' ')
          .trim() || 'Open-Box';

      const imgEl = card.querySelector('img');
      const imageUrl =
        imgEl?.getAttribute('data-src') ||
        imgEl?.getAttribute('data-original') ||
        imgEl?.getAttribute('src') ||
        undefined;

      items.push({
        retailer: 'newegg',
        storeId: STORE_ID,
        sku: sku ?? undefined,
        title,
        conditionLabel: condition,
        priceCents,
        url: absoluteUrl,
        seenAt: now,
        imageUrl: normalizeImage(imageUrl, absoluteUrl),
      });

      if (items.length >= 80) break;
    }

    if (!items.length) {
      // Fallback: attempt to parse embedded JSON containing product info.
      const jsonMatches = html.match(/__INITIAL_STATE__\s*=\s*(\{.*?\})\s*;<\/script>/s);
      if (jsonMatches?.[1]) {
        try {
          const data = JSON.parse(jsonMatches[1]);
          const list = data?.pageData?.items || data?.productList || [];
          if (Array.isArray(list)) {
            for (const entry of list) {
              const title = entry?.title || entry?.itemTitle;
              const urlRaw = entry?.itemUrl || entry?.productUrl;
              const price = entry?.finalPrice || entry?.price || entry?.pricing?.finalPrice;
              if (!title || !urlRaw || !price) continue;
              const numericPrice = Number(price);
              if (!Number.isFinite(numericPrice)) continue;
              const priceCents = Math.round(numericPrice * 100);
              const resolvedUrl = (() => {
                try {
                  return new URL(urlRaw, LISTING_URL).toString();
                } catch {
                  return typeof urlRaw === 'string' ? urlRaw : '';
                }
              })();
              if (!priceCents) continue;
              const sku = entry?.itemNumber || entry?.itemNumberOverride;
              const key = sku || resolvedUrl;
              if (seen.has(key)) continue;
              seen.add(key);
              items.push({
                retailer: 'newegg',
                storeId: STORE_ID,
                sku: sku ?? undefined,
                title: String(title).trim(),
                conditionLabel: 'Open-Box',
                priceCents,
                url: resolvedUrl,
                seenAt: now,
                imageUrl: normalizeImage(entry?.imageUrl || entry?.image, resolvedUrl),
              });
              if (items.length >= 80) break;
            }
          }
        } catch (err) {
          console.warn('[newegg] json fallback parse failed', err);
        }
      }
    }
  } catch (err) {
    console.warn('[newegg] fetch failed', err);
  }

  return { storeId: STORE_ID, items };
}

