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

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: ca ? { ca, rejectUnauthorized: true } : undefined,
});

export const db = drizzle(pool);
