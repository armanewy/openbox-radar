import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  // TODO: join latest inventory for a given watch
  return NextResponse.json({ items: [] });
}
