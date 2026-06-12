import { NextRequest, NextResponse } from "next/server";
import { isHlsUrl } from "@/lib/m3u-parser";
import { extractYoutubeStreamUrl } from "@/lib/yt-extract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get("id");

  if (!videoId || !/^[\w-]{11}$/.test(videoId)) {
    return NextResponse.json({ error: "Invalid video ID" }, { status: 400 });
  }

  try {
    const url = await extractYoutubeStreamUrl(videoId);
    return NextResponse.json({ isHls: isHlsUrl(url) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Extraction failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
