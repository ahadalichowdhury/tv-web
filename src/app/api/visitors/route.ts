import { NextRequest, NextResponse } from "next/server";
import {
  getLiveVisitorCount,
  removeVisitor,
  touchVisitor,
} from "@/lib/visitors";

export async function GET() {
  return NextResponse.json({ count: getLiveVisitorCount() });
}

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json();
    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }
    const count = touchVisitor(sessionId);
    return NextResponse.json({ count });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { sessionId } = await request.json();
    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }
    const count = removeVisitor(sessionId);
    return NextResponse.json({ count });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
