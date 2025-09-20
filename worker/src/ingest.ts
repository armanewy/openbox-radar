export type IngestPayload = {
  retailer: 'bestbuy' | 'microcenter' | 'newegg' | string;
  storeId: string;
  sku?: string;
  title: string;
  conditionLabel: string;
  priceCents: number;
  url: string;
  seenAt?: string;
  imageUrl?: string;
  source?: string;
  channel?: string;
  confidence?: string;
  storeName?: string;
  storeCity?: string;
  storeState?: string;
  expiresAt?: string;
};

export async function postIngest(
  items: IngestPayload[],
  opts: { ingestUrl?: string; secret?: string }
): Promise<{ status: number; inserted: number; body: any }> {
  if (!items.length) {
    return { status: 204, inserted: 0, body: null };
  }

  const ingestUrl = opts.ingestUrl;
  const secret = opts.secret;

  if (!ingestUrl) {
    throw new Error('Missing INGEST_URL');
  }
  if (!secret) {
    throw new Error('Missing CRON_SHARED_SECRET');
  }

  const resp = await fetch(ingestUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({ items }),
  });

  let body: any = null;
  try {
    body = await resp.json();
  } catch {
    body = await resp.text();
  }

  if (!resp.ok) {
    const message = typeof body === 'string' ? body : JSON.stringify(body);
    throw new Error(`Ingest failed ${resp.status}: ${message}`);
  }

  const inserted = typeof body?.inserted === 'number' ? body.inserted : Array.isArray(body?.items) ? body.items.length : 0;
  return { status: resp.status, inserted, body };
}
