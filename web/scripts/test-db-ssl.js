#!/usr/bin/env node
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

(async () => {
  try {
    const caFile = path.resolve(process.cwd(), 'web', 'supabase-ca.crt');
    let ca;
    if (process.env.SUPABASE_CA_B64) {
      ca = Buffer.from(process.env.SUPABASE_CA_B64, 'base64').toString('utf8');
      console.log('Using SUPABASE_CA_B64, length:', ca.length);
    } else if (fs.existsSync(caFile)) {
      ca = fs.readFileSync(caFile, 'utf8');
      console.log('Using file:', caFile, 'length:', ca.length);
    } else {
      console.log('No CA found in env or file');
    }

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: ca ? { ca: [ca], rejectUnauthorized: true } : undefined,
    });

    const res = await pool.query('select version()');
    console.log('Connected OK:', res.rows[0]);
    await pool.end();
  } catch (err) {
    console.error('Connection error:');
    console.error(err);
    process.exit(1);
  }
})();
