// web/lib/drizzle/db.ts
import 'server-only';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

function buildSsl(): true | { ca?: string; rejectUnauthorized?: boolean } {
  // Preferred: pin Supabase CA via base64 env
  const caB64 = process.env.SUPABASE_CA_B64?.trim();
  if (caB64) {
    try {
      const ca = Buffer.from(caB64, 'base64').toString('utf8');
      return { ca }; // verifies against this CA
    } catch {
      /* fall through */
    }
  }
  // Temporary escape hatch if needed
  if (process.env.PG_SSL_INSECURE === '1') {
    return { rejectUnauthorized: false };
  }
  // Use TLS with platform CAs (works if the chain is public)
  return true;
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // use Supabase Shared Pooler (6543) in Vercel
  ssl: buildSsl(),
  max: 5,
  idleTimeoutMillis: 10_000,
});

export const db = drizzle(pool);
