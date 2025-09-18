import pThrottle from 'p-throttle';

const API_KEY = process.env.BESTBUY_API_KEY || '';
if (process.env.BESTBUY_ENABLED === '1' && !API_KEY) {
  console.warn('BESTBUY_ENABLED=1 but BESTBUY_API_KEY is missing');
}

// Global throttle per process: 5 requests/sec
const throttle = pThrottle({ limit: 5, interval: 1000 });

async function rawGet(url: string) {
  const u = new URL(url);
  if (API_KEY) u.searchParams.set('apiKey', API_KEY);
  const res = await fetch(u.toString(), { headers: { accept: 'application/json' } });
  if (res.status === 403) throw new Error('BestBuy 403 (rate limited or unauthorized)');
  if (!res.ok) throw new Error(`BestBuy ${res.status} ${await res.text()}`);
  return res.json();
}

export const bbyGet = throttle(rawGet);

export function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

