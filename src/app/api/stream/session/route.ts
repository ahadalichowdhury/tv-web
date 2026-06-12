import { NextRequest, NextResponse } from "next/server";
import { detectStreamKind } from "@/lib/stream-detect";
import {
  createStreamToken,
  DIRECT_STREAM_CHANNEL_ID,
} from "@/lib/stream-token";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, referer, userAgent } = body as {
      url?: string;
      referer?: string;
      userAgent?: string;
    };

    const trimmed = url?.trim();
    if (!trimmed || !/^https?:\/\//i.test(trimmed)) {
      return NextResponse.json({ error: "Valid http(s) URL required" }, { status: 400 });
    }

    const kind = detectStreamKind(trimmed);
    if (kind === "youtube") {
      return NextResponse.json(
        { error: "Use YouTube channels for YouTube links" },
        { status: 400 }
      );
    }
    if (kind === "dash") {
      return NextResponse.json(
        { error: "DASH (.mpd) is not supported yet. Try an HLS or MP4 link." },
        { status: 400 }
      );
    }

    const token = createStreamToken({
      channelId: DIRECT_STREAM_CHANNEL_ID,
      streamIndex: 0,
      url: trimmed,
      referer: referer?.trim() || undefined,
      userAgent: userAgent?.trim() || undefined,
    });

    return NextResponse.json({
      playUrl: `/api/stream?t=${token}`,
      kind,
    });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
