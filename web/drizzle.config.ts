import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';
import fs from 'node:fs';
import path from 'node:path';

// Try to use the CA; if missing, fall back to not verifying ONLY in dev.
// Prefer a base64 env var (useful for Vercel) and fall back to a file in the repo.
const caFilePath = path.resolve(process.cwd(), 'supabase-ca.crt');
let caBuffer: Buffer | undefined;
if (process.env.SUPABASE_CA_B64) {
  caBuffer = Buffer.from(process.env.SUPABASE_CA_B64, 'base64');
} else if (fs.existsSync(caFilePath)) {
  caBuffer = fs.readFileSync(caFilePath);
}

const caString = caBuffer ? caBuffer.toString('utf8') : undefined;
// In local/dev, allow insecure fallback if no CA is provided to avoid SSL errors during CLI migrations.
const allowInsecure = process.env.DRIZZLE_ALLOW_INSECURE === '1' || process.env.NODE_ENV !== 'production';
const sslOption = caString
  ? { ca: [caString], rejectUnauthorized: true }
  : allowInsecure
    ? { rejectUnauthorized: false }
    : undefined;

export default defineConfig({
  dialect: 'postgresql',
  schema: './lib/drizzle/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
    ssl: sslOption,
  },
});
