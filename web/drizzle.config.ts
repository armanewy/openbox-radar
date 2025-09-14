import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';
import fs from 'node:fs';
import path from 'node:path';

// Try to use the CA; if missing (or you just want to move fast),
// fall back to not verifying ONLY in dev.
const caPath = path.join(process.cwd(), 'supabase-ca.crt');
const haveCA = fs.existsSync(caPath);
const isCI = !!process.env.CI || !!process.env.VERCEL;

export default defineConfig({
  dialect: 'postgresql',
  schema: './lib/drizzle/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL!, // direct 5432 URI with ?sslmode=require
    ssl: haveCA
      ? { ca: fs.readFileSync(caPath, 'utf8') }
      : (isCI ? true : { rejectUnauthorized: false }), // dev fallback; CI uses normal TLS
  },
});
