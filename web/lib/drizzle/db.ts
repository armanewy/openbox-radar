import 'server-only';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

const caPem = Buffer.from(process.env.SUPABASE_CA_B64!, 'base64').toString('utf8');

const pool = new Pool({
  // IMPORTANT: strip query params so url can't override ssl object
  connectionString: process.env.DATABASE_URL!.replace(/\?.*$/, ''),
  ssl: {
    ca: caPem,                 // trust Supabase CA
    rejectUnauthorized: true,  // enforce verification
    servername: 'aws-1-us-east-2.pooler.supabase.com', // SNI/hostname match
    minVersion: 'TLSv1.2',
  },
  max: 5,
  idleTimeoutMillis: 10_000,
});

export const db = drizzle(pool);
