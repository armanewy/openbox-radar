import 'server-only';
import { headers } from 'next/headers';

export function getBaseUrl(): string {
  const env = process.env.APP_BASE_URL;
  if (env && env.startsWith('http')) return env.replace(/\/$/, '');
  const h = headers();
  const host = h.get('host');
  const proto = h.get('x-forwarded-proto') ?? 'https';
  if (host) return `${proto}://${host}`;
  // reasonable dev fallback
  return 'http://localhost:3000';
}

export function absoluteUrl(path: string): string {
  const base = getBaseUrl();
  if (!path.startsWith('/')) path = '/' + path;
  return base + path;
}

