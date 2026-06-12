import { parsePlaylistContent } from "./playlist-content";
import {
  extractYoutubeVideoId,
  getYoutubeThumbnail,
} from "./youtube";
import {
  refreshPlaylistChannels,
  savePlaylistWithChannels,
} from "./storage";
import type { ParsedChannel } from "./types";

export async function fetchM3UFromUrl(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch playlist: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

export function parseM3UContent(content: string): ParsedChannel[] {
  return parsePlaylistContent(content);
}

export async function importPlaylistFromUrl(name: string, url: string) {
  const content = await fetchM3UFromUrl(url);
  const channels = parseM3UContent(content);
  return savePlaylistWithChannels(
    { name, sourceType: "url", sourceUrl: url },
    channels
  );
}

export async function importPlaylistFromStream(
  name: string,
  streamUrl: string,
  userAgent?: string,
  referer?: string
) {
  const content = `#EXTM3U\n#EXTINF:-1,${name}\n${streamUrl}`;
  const channels = parseM3UContent(content);
  if (userAgent || referer) {
    channels[0].streams[0].userAgent = userAgent;
    channels[0].streams[0].referer = referer;
  }
  return savePlaylistWithChannels({ name, sourceType: "file" }, channels);
}

export async function importPlaylistFromContent(name: string, content: string) {
  const channels = parseM3UContent(content);
  return savePlaylistWithChannels({ name, sourceType: "file" }, channels);
}

export async function importYoutubeChannel(
  playlistName: string,
  channelName: string,
  youtubeUrl: string,
  group = "YouTube"
) {
  const videoId = extractYoutubeVideoId(youtubeUrl);
  if (!videoId) {
    throw new Error("Invalid YouTube URL");
  }

  const channel: ParsedChannel = {
    name: channelName.trim() || playlistName.trim(),
    logo: getYoutubeThumbnail(videoId),
    group: group.trim() || "YouTube",
    streams: [{ url: youtubeUrl.trim(), type: "youtube" }],
  };

  return savePlaylistWithChannels(
    { name: playlistName.trim(), sourceType: "file" },
    [channel]
  );
}

export async function importYoutubePlaylist(
  playlistName: string,
  entries: { name: string; url: string }[],
  group = "YouTube"
) {
  const channels: ParsedChannel[] = [];

  for (const entry of entries) {
    const videoId = extractYoutubeVideoId(entry.url);
    if (!videoId) {
      throw new Error(`Invalid YouTube URL: ${entry.url}`);
    }
    channels.push({
      name: entry.name.trim(),
      logo: getYoutubeThumbnail(videoId),
      group: group.trim() || "YouTube",
      streams: [{ url: entry.url.trim(), type: "youtube" }],
    });
  }

  if (channels.length === 0) {
    throw new Error("No YouTube channels to add");
  }

  return savePlaylistWithChannels(
    { name: playlistName.trim(), sourceType: "file" },
    channels
  );
}

export async function refreshPlaylistFromSource(playlistId: string, sourceUrl: string) {
  const content = await fetchM3UFromUrl(sourceUrl);
  const channels = parseM3UContent(content);
  return refreshPlaylistChannels(playlistId, channels);
}
