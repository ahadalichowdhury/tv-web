import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import {
  importPlaylistFromContent,
  importPlaylistFromStream,
  importPlaylistFromUrl,
  importYoutubeChannel,
  importYoutubePlaylist,
} from "@/lib/playlist-service";
import { getPlaylists } from "@/lib/storage";

export async function GET() {
  const playlists = await getPlaylists();
  return NextResponse.json(playlists);
}

export async function POST(request: NextRequest) {
  const authed = await isAdminAuthenticated();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      name,
      sourceType,
      sourceUrl,
      content,
      streamUrl,
      userAgent,
      referer,
      channelName,
      youtubeUrl,
      youtubeEntries,
      group,
    } = body as {
      name?: string;
      sourceType?: "url" | "file" | "stream" | "youtube";
      sourceUrl?: string;
      content?: string;
      streamUrl?: string;
      userAgent?: string;
      referer?: string;
      channelName?: string;
      youtubeUrl?: string;
      youtubeEntries?: { name: string; url: string }[];
      group?: string;
    };

    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    if (sourceType === "url") {
      if (!sourceUrl?.trim()) {
        return NextResponse.json({ error: "URL is required" }, { status: 400 });
      }
      const result = await importPlaylistFromUrl(name.trim(), sourceUrl.trim());
      return NextResponse.json(result, { status: 201 });
    }

    if (sourceType === "file") {
      if (!content?.trim()) {
        return NextResponse.json(
          { error: "M3U content is required" },
          { status: 400 }
        );
      }
      const result = await importPlaylistFromContent(name.trim(), content);
      return NextResponse.json(result, { status: 201 });
    }

    if (sourceType === "stream") {
      if (!streamUrl?.trim()) {
        return NextResponse.json({ error: "M3U8 URL is required" }, { status: 400 });
      }
      const result = await importPlaylistFromStream(
        name.trim(),
        streamUrl.trim(),
        userAgent,
        referer
      );
      return NextResponse.json(result, { status: 201 });
    }

    if (sourceType === "youtube") {
      if (youtubeEntries?.length) {
        const result = await importYoutubePlaylist(
          name.trim(),
          youtubeEntries,
          group
        );
        return NextResponse.json(result, { status: 201 });
      }
      if (!youtubeUrl?.trim()) {
        return NextResponse.json({ error: "YouTube URL is required" }, { status: 400 });
      }
      const result = await importYoutubeChannel(
        name.trim(),
        channelName?.trim() || name.trim(),
        youtubeUrl.trim(),
        group
      );
      return NextResponse.json(result, { status: 201 });
    }

    return NextResponse.json({ error: "Invalid source type" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to add playlist";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
