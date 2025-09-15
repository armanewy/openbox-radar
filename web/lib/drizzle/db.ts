import 'server-only';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

// Ship-now config: encrypted connection, no CA verification.
// We'll tighten this later to pin the pooler's CA bundle.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // use Supabase Session/Shared Pooler (:6543)
  ssl: { rejectUnauthorized: false },         // <-- force permissive TLS for now
  max: 5,
  idleTimeoutMillis: 10_000,
});

export const db = drizzle(pool);
