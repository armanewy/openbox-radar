import 'server-only';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

const useInsecure = process.env.PG_SSL_INSECURE === '1';
const hasB64 = !!process.env.SUPABASE_CA_B64?.trim();

let ssl: any;
if (useInsecure) {
  ssl = { rejectUnauthorized: false };
} else if (hasB64) {
  try {
    const ca = Buffer.from(process.env.SUPABASE_CA_B64!, 'base64').toString('utf8');
    ssl = { ca };
  } catch {
    ssl = true;
  }
} else {
  ssl = true;
}

console.info(
  'db:init',
  JSON.stringify({
    urlHost: (() => {
      try {
        const u = new URL(process.env.DATABASE_URL || '');
        return `${u.hostname}:${u.port}`;
      } catch { return null; }
    })(),
    insecure: useInsecure,
    hasB64,
    sslType: typeof ssl === 'object' ? (ssl.rejectUnauthorized === false ? 'insecure' : 'ca') : 'true'
  })
);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Supabase pooler :6543
  ssl,
  max: 5,
  idleTimeoutMillis: 10_000,
});

export const db = drizzle(pool);
