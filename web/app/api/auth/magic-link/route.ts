import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/drizzle/db";
import { users, magicTokens } from "@/lib/drizzle/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

    // upsert user (IDs generated in app)
    let u = (await db.select().from(users).where(eq(users.email, email)))[0];
    if (!u) {
      u = (await db.insert(users).values({ id: crypto.randomUUID(), email }).returning())[0];
    }

    // create token
    const token = crypto.randomBytes(24).toString("base64url");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await db.insert(magicTokens).values({
      id: crypto.randomUUID(),
      userId: u.id,
      email,
      token,
      expiresAt,
    });

    const link = `${process.env.APP_BASE_URL}/api/auth/callback?token=${token}`;

    if (!resend) {
      // TEMP: let you proceed even if email isn’t wired
      console.warn("RESEND_API_KEY missing; returning debug_link");
      return NextResponse.json({ ok: true, debug_link: link });
    }

    const result = await resend.emails.send({
      from: "Open-Box Radar <login@openboxradar.com>",
      to: email,
      subject: "Your sign-in link",
      html: `<p>Click to sign in:</p><p><a href="${link}">${link}</a></p><p>This link expires in 15 minutes.</p>`,
    } as any);

    if ((result as any)?.error) {
      console.error("Resend send error:", (result as any).error);
      return NextResponse.json({ ok: false, debug_link: link }, { status: 200 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("magic-link error:", err);
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
