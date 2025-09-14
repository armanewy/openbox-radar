import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';
import fs from 'node:fs';
import path from 'node:path';

export default defineConfig({
  dialect: 'postgresql',
  schema: './lib/drizzle/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL!, // use the 5432 “Direct connection” URI with ?sslmode=require
    ssl: { ca: fs.readFileSync(path.join(process.cwd(), 'supabase-ca.crt'), 'utf8') },
  },
});
