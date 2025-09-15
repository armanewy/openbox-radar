import 'server-only';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const pool = new Pool({
  // IMPORTANT: keep whatever TLS you settled on — this version assumes you already fixed TLS.
  // If you're using SUPABASE_CA_B64:
  connectionString: process.env.DATABASE_URL!.replace(/\?.*$/, ''),
  ssl: process.env.SUPABASE_CA_B64
    ? {
        ca: Buffer.from(process.env.SUPABASE_CA_B64, 'base64').toString('utf8'),
        rejectUnauthorized: true,
        minVersion: 'TLSv1.2',
        servername: 'aws-1-us-east-2.pooler.supabase.com',
      }
    : { rejectUnauthorized: false, minVersion: 'TLSv1.2' },
  max: 5,
  idleTimeoutMillis: 10_000,
});

// ⬇️ pass schema so db.query.<table> becomes available & typed
export const db = drizzle(pool, { schema });
export type DB = typeof db;
