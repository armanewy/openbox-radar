// web/lib/drizzle/db.ts
import 'server-only';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

function sslConfig(): true | { ca?: string; rejectUnauthorized?: boolean } {
  // Ship now, verify later
  if (process.env.PG_SSL_INSECURE === '1') return { rejectUnauthorized: false };

  // Preferred: pin Supabase CA via base64
  const b64 = process.env.SUPABASE_CA_B64?.trim();
  if (b64) {
    try {
      const ca = Buffer.from(b64, 'base64').toString('utf8');
      return { ca };
    } catch {
      // fall through
    }
  }
  return true; // default TLS using platform trust store
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Supabase Session/Shared Pooler (6543)
  ssl: sslConfig(),
  max: 5,
  idleTimeoutMillis: 10_000,
});

export const db = drizzle(pool);
