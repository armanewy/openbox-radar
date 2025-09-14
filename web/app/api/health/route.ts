import { NextResponse } from "next/server";
import { db } from "@/lib/drizzle/db";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
    const r = await db.execute(sql`select 1 as ok`);
    return NextResponse.json({ ok: r.rows?.[0]?.ok === 1 });
  } catch (e: any) {
    console.error("db health error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
