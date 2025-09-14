import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  // TODO: return current user watches
  return NextResponse.json({ watches: [] });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  // TODO: validate & insert
  return NextResponse.json({ ok: true, watch: body });
}
