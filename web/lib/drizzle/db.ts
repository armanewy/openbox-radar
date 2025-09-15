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

// If we have the CA as an env var but NODE_EXTRA_CA_CERTS isn't set, write
// If we have the CA as an env var, write it to multiple likely runtime paths
// and set NODE_EXTRA_CA_CERTS to whichever path is present (or to the env
// override). This increases the chance that every serverless instance can
// find the CA regardless of working directory differences.
if (caString) {
  const candidatePaths = [
    process.env.NODE_EXTRA_CA_CERTS || '',
    '/vercel/path0/web/supabase-ca.crt',
    '/vercel/path0/supabase-ca.crt',
    '/tmp/supabase-ca.crt',
  ].filter(Boolean) as string[];

  const wrote: string[] = [];
  for (const p of candidatePaths) {
    try {
      // Ensure parent dir exists for paths inside project
      const dir = path.dirname(p);
      if (!fs.existsSync(dir)) {
        try {
          fs.mkdirSync(dir, { recursive: true });
        } catch (e) {}
      }
      fs.writeFileSync(p, caString, { encoding: 'utf8' });
      wrote.push(p);
    } catch (e) {
      // ignore individual write failures
    }
  }

  // Prefer an explicit NODE_EXTRA_CA_CERTS if present, otherwise pick the
  // first path we successfully wrote to.
  if (!process.env.NODE_EXTRA_CA_CERTS) {
    if (wrote.length) {
      process.env.NODE_EXTRA_CA_CERTS = wrote[0];
      console.log('db: wrote CA to', wrote);
    } else {
      console.error('db: failed to write CA to any candidate path');
    }
  } else {
    console.log('db: NODE_EXTRA_CA_CERTS already set to', process.env.NODE_EXTRA_CA_CERTS);
  }
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: caString ? { ca: [caString], rejectUnauthorized: true } : undefined,
});

export const db = drizzle(pool);

export function getDbDebug() {
  return {
    supabaseCaB64: !!process.env.SUPABASE_CA_B64,
    caLength: ca ? ca.length : 0,
    nodeExtra: process.env.NODE_EXTRA_CA_CERTS ?? null,
    caFilePathResolved: caFilePath,
    caWrotePaths: (() => {
      try {
        return [
          '/vercel/path0/web/supabase-ca.crt',
          '/vercel/path0/supabase-ca.crt',
          '/tmp/supabase-ca.crt',
          caFilePath,
        ].map(p => ({ path: p, exists: fs.existsSync(p) }));
      } catch (e) {
        return null;
      }
    })(),
  };
}
