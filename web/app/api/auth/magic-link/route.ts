import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/drizzle/db";
import { users, magicTokens } from "@/lib/drizzle/schema";
import { eq, sql } from "drizzle-orm";
import crypto from "crypto";
import { Resend } from "resend";

function makeResend() {
  const key = process.env.RESEND_API_KEY;
  return key ? new Resend(key) : null;
}
const resend = makeResend();

async function ensureAuthTables() {
  // safe, idempotent bootstrap for prod if migrations didn’t run
  await db.execute(sql`create extension if not exists pgcrypto;`);
  await db.execute(sql`
    create table if not exists "users" (
      "id" uuid primary key default gen_random_uuid(),
      "email" text not null unique,
      "created_at" timestamptz not null default now()
    );
  `);
  await db.execute(sql`
    create table if not exists "magic_tokens" (
      "id" uuid primary key default gen_random_uuid(),
      "user_id" uuid references "users"("id") on delete cascade,
      "email" text not null,
      "token" text not null unique,
      "expires_at" timestamptz not null,
      "used" boolean not null default false,
      "created_at" timestamptz not null default now()
    );
  `);
}

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

    // ensure tables exist (no-op if already migrated)
    await ensureAuthTables();

    // upsert user
    const existing = await db.select().from(users).where(eq(users.email, email));
    const user = existing[0] ?? (await db.insert(users).values({ email }).returning())[0];

    // create token
    const token = crypto.randomBytes(24).toString("base64url");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await db.insert(magicTokens).values({ email, userId: user.id, token, expiresAt });

    const link = `${process.env.APP_BASE_URL}/api/auth/callback?token=${token}`;

    if (!resend) {
      console.warn("RESEND_API_KEY missing; returning debug_link instead of sending.");
      return NextResponse.json({ ok: true, debug_link: link });
    }

    const sent = await resend.emails.send({
      from: "Open-Box Radar <login@openboxradar.com>",
      to: email,
      subject: "Your sign-in link",
      html: `<p>Click to sign in:</p><p><a href="${link}">${link}</a></p><p>This link expires in 15 minutes.</p>`
    } as any);

    if ((sent as any)?.error) {
      console.error("Resend send error:", (sent as any).error);
      // still return the link so you can log in while we tweak email config
      return NextResponse.json({ ok: false, debug_link: link }, { status: 200 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("magic-link error:", err);
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
