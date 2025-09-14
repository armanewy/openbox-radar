// web/lib/drizzle/db.ts
import 'server-only';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import fs from 'node:fs';
import path from 'node:path';

// Load CA from SUPABASE_CA_B64 (preferred in Vercel) or fall back to a repo file.
const caFilePath = path.resolve(process.cwd(), 'supabase-ca.crt');
let ca: Buffer | undefined;
if (process.env.SUPABASE_CA_B64) {
  ca = Buffer.from(process.env.SUPABASE_CA_B64, 'base64');
} else if (fs.existsSync(caFilePath)) {
  ca = fs.readFileSync(caFilePath);
}
const caString: string | undefined = ca ? ca.toString('utf8') : undefined;

// Masked debug: show whether CA is present and its length (don't print the cert).
try {
  console.log('db: SUPABASE_CA_B64 present:', !!process.env.SUPABASE_CA_B64, 'len:', ca ? ca.length : 0);
  console.log('db: NODE_EXTRA_CA_CERTS:', !!process.env.NODE_EXTRA_CA_CERTS);
} catch (e) {
  // ignore logging errors
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: caString ? { ca: [caString], rejectUnauthorized: true } : undefined,
});

export const db = drizzle(pool);
