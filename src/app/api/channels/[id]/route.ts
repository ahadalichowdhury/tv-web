import { NextRequest, NextResponse } from "next/server";
import { getChannel } from "@/lib/storage";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const channel = await getChannel(id);
  if (!channel) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(channel);
}
