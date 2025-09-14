// web/lib/drizzle/db.ts
import 'server-only';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // If you used the CA file locally you can keep it there,
  // but on Vercel this is usually enough because your URL has sslmode=require.
  // ssl: { ca: process.env.SUPABASE_CA ?? undefined },
});

export const db = drizzle(pool);
