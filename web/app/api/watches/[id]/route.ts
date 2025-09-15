import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/drizzle/db";
import { watches } from "@/lib/drizzle/schema";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/utils/auth";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const s = getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = params.id;
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  await db.delete(watches).where(and(eq(watches.id, id), eq(watches.user_id, s.uid)));
  return NextResponse.json({ ok: true });
}

