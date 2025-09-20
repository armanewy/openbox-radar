#!/usr/bin/env node
require('dotenv/config');

const INGEST = process.env.INGEST_URL || 'http://localhost:3000/api/ingest';
const SECRET = process.env.CRON_SECRET || '';

async function main() {
  const items = [
    {
      retailer: 'microcenter',
      storeId: 'mc-cambridge',
      sku: 'DEV-MC-001',
      title: 'DEV Micro Center Open-Box Monitor',
      conditionLabel: 'Open-Box Satisfactory',
      priceCents: 17999,
      url: 'https://www.microcenter.com/product/dev-mc-001',
      seenAt: new Date().toISOString(),
    },
    {
      retailer: 'bestbuy',
      storeId: 'bby-123',
      sku: 'DEV-BBY-001',
      title: 'DEV Best Buy Open-Box Laptop',
      conditionLabel: 'Open-Box Excellent',
      priceCents: 89900,
      url: 'https://www.bestbuy.com/site/sku/DEV-BBY-001.p',
      seenAt: new Date().toISOString(),
    },
    {
      retailer: 'newegg',
      storeId: 'newegg-online',
      sku: 'DEV-NE-001',
      title: 'DEV Newegg Open-Box GPU',
      conditionLabel: 'Open-Box',
      priceCents: 42999,
      url: 'https://www.newegg.com/p/DEV-NE-001',
      seenAt: new Date().toISOString(),
    },
  ];

  const r = await fetch(INGEST, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-cron-secret': SECRET,
    },
    body: JSON.stringify({ items }),
  });
  const json = await r.json().catch(() => ({}));
  console.log('ingest response', r.status, json);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

