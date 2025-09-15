export function parseProductUrl(raw: string | null): { retailer?: 'bestbuy'|'microcenter'; sku?: string } | null {
  if (!raw) return null;
  let url: URL;
  try { url = new URL(raw); } catch { return null; }
  const host = url.hostname.toLowerCase();
  // Best Buy: SKU often numeric, appears in query or path like /site/.../sku/1234567.p? or ?skuId=...
  if (host.includes('bestbuy.com')) {
    const skuId = url.searchParams.get('skuId') || url.searchParams.get('sku');
    if (skuId) return { retailer: 'bestbuy', sku: skuId };
    const m = url.pathname.match(/sku\/(\d{5,9})/i) || url.pathname.match(/\/(\d{5,9})\.p/i);
    if (m?.[1]) return { retailer: 'bestbuy', sku: m[1] };
    return { retailer: 'bestbuy' };
  }
  // Micro Center: SKU sometimes after /product/<sku>/ or query ?sku=...; fallback to item number in path
  if (host.includes('microcenter.com')) {
    const sku = url.searchParams.get('sku');
    if (sku) return { retailer: 'microcenter', sku };
    const m = url.pathname.match(/product\/(\d{5,9})/i);
    if (m?.[1]) return { retailer: 'microcenter', sku: m[1] };
    return { retailer: 'microcenter' };
  }
  return null;
}

