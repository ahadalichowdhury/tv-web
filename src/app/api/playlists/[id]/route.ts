import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { refreshPlaylistFromSource } from "@/lib/playlist-service";
import { deletePlaylist, getPlaylist } from "@/lib/storage";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const playlist = await getPlaylist(id);
  if (!playlist) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(playlist);
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const authed = await isAdminAuthenticated();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const deleted = await deletePlaylist(id);
  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}

export async function POST(_request: NextRequest, context: RouteContext) {
  const authed = await isAdminAuthenticated();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const playlist = await getPlaylist(id);
  if (!playlist) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (playlist.sourceType !== "url" || !playlist.sourceUrl) {
    return NextResponse.json(
      { error: "Only URL-based playlists can be refreshed" },
      { status: 400 }
    );
  }

  try {
    const result = await refreshPlaylistFromSource(id, playlist.sourceUrl);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Refresh failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
