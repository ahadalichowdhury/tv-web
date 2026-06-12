import { NextRequest, NextResponse } from "next/server";
import { extractYoutubeVideoId, isYoutubeStream } from "@/lib/youtube";
import { buildStreamProxyPath } from "@/lib/stream-token";
import { getChannel } from "@/lib/storage";

export async function GET(request: NextRequest) {
  const channelId = request.nextUrl.searchParams.get("channelId");
  const streamIndex = Number(request.nextUrl.searchParams.get("streamIndex") ?? "0");

  if (!channelId) {
    return NextResponse.json({ error: "channelId required" }, { status: 400 });
  }

  if (!Number.isFinite(streamIndex) || streamIndex < 0) {
    return NextResponse.json({ error: "Invalid streamIndex" }, { status: 400 });
  }

  const channel = await getChannel(channelId);
  if (!channel) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const stream = channel.streams[streamIndex] ?? channel.streams[0];
  if (!stream?.url) {
    return NextResponse.json({ error: "No stream available" }, { status: 404 });
  }

  if (isYoutubeStream(stream)) {
    const youtubeId = extractYoutubeVideoId(stream.url);
    if (!youtubeId) {
      return NextResponse.json({ error: "Invalid YouTube stream" }, { status: 400 });
    }
    return NextResponse.json({
      type: "youtube",
      youtubeId,
    });
  }

  const playbackUrl = buildStreamProxyPath(channelId, streamIndex);

  return NextResponse.json({
    type: "hls",
    playbackUrl,
  });
}
