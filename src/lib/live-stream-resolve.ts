import { parsePlaylistContent } from "./playlist-content";
import { fetchM3UFromUrl } from "./playlist-service";
import { getPlaylist } from "./storage";
import type { Channel, StreamSource } from "./types";

const m3uCache = new Map<string, { content: string; at: number }>();
const M3U_CACHE_MS = 60_000;

async function fetchM3UCached(sourceUrl: string): Promise<string> {
  const cached = m3uCache.get(sourceUrl);
  if (cached && Date.now() - cached.at < M3U_CACHE_MS) {
    return cached.content;
  }
  const content = await fetchM3UFromUrl(sourceUrl);
  m3uCache.set(sourceUrl, { content, at: Date.now() });
  return content;
}

function findMatchingChannel(parsed: ReturnType<typeof parsePlaylistContent>, channel: Channel) {
  if (channel.tvgId) {
    const byTvg = parsed.find((c) => c.tvgId && c.tvgId === channel.tvgId);
    if (byTvg) return byTvg;
  }
  const byNameGroup = parsed.find(
    (c) => c.name === channel.name && c.group === channel.group
  );
  if (byNameGroup) return byNameGroup;
  return parsed.find((c) => c.name === channel.name);
}

/** Pull the latest stream URL + headers from a live M3U source (Pastebin, etc.). */
export async function resolveLiveStream(
  channel: Channel,
  streamIndex: number
): Promise<StreamSource | null> {
  const playlist = await getPlaylist(channel.playlistId);
  if (!playlist?.sourceUrl) return null;

  try {
    const content = await fetchM3UCached(playlist.sourceUrl);
    const parsed = parsePlaylistContent(content);
    const match = findMatchingChannel(parsed, channel);
    if (!match?.streams.length) return null;
    return match.streams[streamIndex] ?? match.streams[0];
  } catch {
    return null;
  }
}
