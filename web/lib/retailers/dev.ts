export type DevItem = {
  retailer: 'bestbuy'|'microcenter';
  storeId: string;
  sku?: string;
  title: string;
  conditionLabel: string;
  priceCents: number;
  url: string;
  seenAt: string;
};

export async function fetchDevItems(watch: {
  retailer: 'bestbuy'|'microcenter';
  sku: string | null;
}) : Promise<DevItem[]> {
  // Produce at least one item so we exercise the whole pipeline
  const storeId = watch.retailer === 'bestbuy' ? 'bby-123' : 'mc-cambridge';
  const base = 99900;
  const priceCents = base - Math.floor(Math.random() * 15000); // random drop
  const title = watch.sku ? `DEV ${watch.sku}` : `DEV Open-Box Example (${watch.retailer})`;
  return [{
    retailer: watch.retailer,
    storeId,
    sku: watch.sku || undefined,
    title,
    conditionLabel: 'Open-Box Excellent',
    priceCents,
    url: 'https://example.com',
    seenAt: new Date().toISOString(),
  }];
}
