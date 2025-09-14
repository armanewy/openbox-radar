import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/drizzle/db";
import { magicTokens, users } from "@/lib/drizzle/schema";
import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return NextResponse.redirect(new URL("/", req.url));

  const rows = await db.select().from(magicTokens).where(eq(magicTokens.token, token));
  const row = rows[0];
  const expired = row ? new Date(row.expiresAt) < new Date() : true;
  if (!row || row.used || expired) {
    return NextResponse.redirect(new URL("/?error=expired", req.url));
  }
  await db.update(magicTokens).set({ used: true }).where(eq(magicTokens.token, token));


  if (!row.userId) {
    return NextResponse.redirect(new URL("/?error=invalid", req.url));
  }
  const u = (await db.select().from(users).where(eq(users.id, row.userId)))[0];

  const jwtToken = jwt.sign({ uid: u.id, email: u.email }, process.env.JWT_SECRET!, { expiresIn: "30d" });

  const res = NextResponse.redirect(new URL("/app", req.url));
  res.cookies.set("obr_session", jwtToken, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60*60*24*30 });
  return res;
}
