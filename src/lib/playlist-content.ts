import { parseJsonPlaylist } from "./json-playlist-parser";
import { parseM3U } from "./m3u-parser";
import type { ParsedChannel } from "./types";

function looksLikeM3U(content: string): boolean {
  const trimmed = content.trim();
  return trimmed.startsWith("#EXTM3U") || trimmed.includes("#EXTINF");
}

function looksLikeJson(content: string): boolean {
  const trimmed = content.trim();
  return trimmed.startsWith("[") || trimmed.startsWith("{");
}

export function parsePlaylistContent(content: string): ParsedChannel[] {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error("Playlist content is empty");
  }

  if (looksLikeM3U(trimmed)) {
    const channels = parseM3U(content);
    if (channels.length > 0) return channels;
  }

  if (looksLikeJson(trimmed)) {
    const channels = parseJsonPlaylist(content);
    if (channels.length > 0) return channels;
  }

  const m3uFallback = parseM3U(content);
  if (m3uFallback.length > 0) return m3uFallback;

  const jsonFallback = parseJsonPlaylist(content);
  if (jsonFallback.length > 0) return jsonFallback;

  throw new Error(
    "No channels found. Supported formats: M3U (#EXTM3U) or JSON channel lists."
  );
}
