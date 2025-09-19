import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/drizzle/db";
import { watches, users, magicTokens } from "@/lib/drizzle/schema";
import { getSession } from "@/lib/utils/auth";
import { and, desc, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { Resend } from "resend";
import { generateToken, normalizeEmail, tokenExpiry, isValidEmail } from "@/lib/auth/tokens";

const WatchInput = z.object({
  retailer: z.enum(["bestbuy","microcenter"]),
  sku: z.string().optional(),
  product_url: z.string().url().optional(),
  keywords: z.array(z.string()).optional(),
  zipcode: z.string().min(3).max(10),
  radius_miles: z.number().int().min(1).max(200).default(25),
  stores: z.array(z.string()).optional(),
  price_ceiling_cents: z.number().int().positive().optional(),
  min_condition: z.enum(["certified","excellent","satisfactory","fair","unknown"]).default("fair"),
  // anonymous path additions
  email: z.string().email().optional(),
  next: z.string().startsWith('/').optional(),
});

export async function GET() {
  const s = getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rows = await db.select().from(watches).where(eq(watches.user_id, s.uid));
  return NextResponse.json({ watches: rows });
}

export async function POST(req: NextRequest) {
  const s = getSession();
  const body = await req.json();
  const parsed = WatchInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  // derive user (session or email)
  let userId: string | null = s?.uid ?? null;
  let email: string | null = null;
  if (!userId) {
    const rawEmail = parsed.data.email ? normalizeEmail(parsed.data.email) : '';
    if (!isValidEmail(rawEmail)) {
      return NextResponse.json({ error: "email_required" }, { status: 401 });
    }
    email = rawEmail;
    // find or create user by email
    let user = await db.query.users.findFirst({ where: eq(users.email, rawEmail) });
    if (!user) {
      const [u] = await db.insert(users).values({ email: rawEmail }).returning();
      user = u!;
    }
    userId = user.id;
  }
  // If url provided but no sku, try parsing to infer sku
  let sku = parsed.data.sku ?? undefined;
  if (!sku && parsed.data.product_url) {
    try {
      const { parseProductUrl } = await import("@/lib/utils/parse");
      const info = parseProductUrl(parsed.data.product_url);
      if (info?.sku) sku = info.sku;
    } catch {}
  }
  const w = await db.insert(watches).values({
    user_id: userId!,
    retailer: parsed.data.retailer as any,
    sku: sku ?? null,
    product_url: parsed.data.product_url ?? null,
    keywords: parsed.data.keywords ?? null,                                  // [] | null
    zipcode: parsed.data.zipcode ?? null,
    radius_miles: (parsed.data.radius_miles ?? parsed.data.radius_miles) ?? null,
    stores: parsed.data.stores ?? null,                                      // [] | null
    price_ceiling_cents:
      (parsed.data.price_ceiling_cents ?? parsed.data.price_ceiling_cents) ?? null,
    min_condition: (parsed.data.min_condition ?? parsed.data.min_condition) as any,
    verified: !!s, // if not signed-in, pending until verify
    active: true, // REQUIRED (DB says NOT NULL, no default)
  }).returning();

  // If anonymous flow, send magic link (throttled like /api/auth/magic-link)
  if (!s && email) {
    try {
      const nowMinus60 = new Date(Date.now() - 60_000);
      const recent = await db.query.magicTokens.findFirst({
        where: and(eq(magicTokens.email, email), eq(magicTokens.used, false), gt(magicTokens.createdAt, nowMinus60)),
        orderBy: [desc(magicTokens.createdAt)],
        columns: { id: true },
      });
      if (!recent) {
        const token = generateToken();
        const expiresAt = tokenExpiry(15);
        await db.insert(magicTokens).values({ userId: userId!, email, token, expiresAt });
        const APP_BASE_URL = process.env.APP_BASE_URL ?? 'http://localhost:3000';
        const url = new URL('/api/auth/verify', APP_BASE_URL);
        url.searchParams.set('token', token);
        const next = parsed.data.next;
        if (next) url.searchParams.set('next', next);
        const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
        if (resend) {
          await resend.emails.send({
            from: 'Openbox Radar <auth@openboxradar.com>',
            to: email,
            subject: 'Confirm your watch (magic link)',
            html: `<p>Click to confirm and activate alerts:</p><p><a href="${url.toString()}">${url.toString()}</a></p>`,
          });
        } else {
          console.warn('[watch magic] link:', url.toString());
        }
      }
    } catch (e) {
      console.warn('email send failed', e);
    }
    return NextResponse.json({ ok: true, pending: true });
  }

  return NextResponse.json({ watch: w[0], ok: true });
}
