import 'server-only';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

// TEMP: ship-now TLS — encrypted, but skip any verification paths.
// We'll replace this with proper CA pinning after auth works end-to-end.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Supabase session/shared pooler :6543
  ssl: {
    rejectUnauthorized: false,
    // This bypasses hostname/cert chain checks even if some code path re-enables TLS verify.
    checkServerIdentity: () => undefined,
    minVersion: 'TLSv1.2',
  } as any,
  max: 5,
  idleTimeoutMillis: 10_000,
});

export const db = drizzle(pool);
