import type { ParsedChannel, StreamSource } from "./types";

const URL_PATTERN = /https?:\/\/[^\s"'<>]+/gi;

function extractAttr(line: string, key: string): string | undefined {
  const regex = new RegExp(`${key}="([^"]*)"`, "i");
  const match = line.match(regex);
  return match?.[1]?.trim() || undefined;
}

function extractChannelName(line: string): string {
  const commaIdx = line.lastIndexOf(",");
  if (commaIdx === -1) return "Unknown Channel";

  let namePart = line.slice(commaIdx + 1).trim();
  namePart = namePart.replace(URL_PATTERN, "").trim();
  return namePart || "Unknown Channel";
}

function extractInlineUrlsFromName(line: string): string[] {
  const commaIdx = line.lastIndexOf(",");
  if (commaIdx === -1) return [];
  const namePart = line.slice(commaIdx + 1);
  return [...namePart.matchAll(URL_PATTERN)].map((m) => m[0].trim());
}

function isStreamUrl(line: string): boolean {
  const trimmed = line.trim();
  return /^https?:\/\//i.test(trimmed) && !trimmed.startsWith("#");
}

function isVlcOpt(line: string): boolean {
  const trimmed = line.trim();
  return (
    trimmed.startsWith("#EXTVLCOPT:") ||
    trimmed.startsWith("EXTVLCOPT:") ||
    trimmed.startsWith("#EXTVLCOPT:")
  );
}

function parseVlcOpt(line: string): Partial<StreamSource> {
  const normalized = line.trim().replace(/^#?EXTVLCOPT:/i, "");
  if (normalized.startsWith("http-user-agent=")) {
    return { userAgent: normalized.slice("http-user-agent=".length).trim() };
  }
  if (
    normalized.startsWith("http-referrer=") ||
    normalized.startsWith("http-referer=")
  ) {
    const value = normalized.replace(/^http-referr?er=/i, "").trim();
    return { referer: value };
  }
  return {};
}

function mergeStreamOpts(
  base: Partial<StreamSource>,
  extra: Partial<StreamSource>
): Partial<StreamSource> {
  return {
    userAgent: extra.userAgent ?? base.userAgent,
    referer: extra.referer ?? base.referer,
  };
}

function finalizeChannel(
  meta: Omit<ParsedChannel, "streams">,
  pendingOpts: Partial<StreamSource>,
  urls: string[]
): ParsedChannel | null {
  const uniqueUrls = [...new Set(urls.filter(Boolean))];
  if (uniqueUrls.length === 0) return null;

  const streams: StreamSource[] = uniqueUrls.map((url) => ({
    url,
    userAgent: pendingOpts.userAgent,
    referer: pendingOpts.referer,
  }));

  return {
    ...meta,
    streams,
  };
}

export function parseM3U(content: string): ParsedChannel[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const channels: ParsedChannel[] = [];

  let pendingMeta: Omit<ParsedChannel, "streams"> | null = null;
  let pendingOpts: Partial<StreamSource> = {};
  let pendingUrls: string[] = [];

  const flush = () => {
    if (!pendingMeta) return;
    const channel = finalizeChannel(pendingMeta, pendingOpts, pendingUrls);
    if (channel) channels.push(channel);
    pendingMeta = null;
    pendingOpts = {};
    pendingUrls = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line === "#EXTM3U") continue;

    if (line.startsWith("#EXTINF")) {
      flush();

      const inlineUrls = extractInlineUrlsFromName(line);
      pendingMeta = {
        name: extractChannelName(line),
        logo: extractAttr(line, "tvg-logo"),
        group: extractAttr(line, "group-title") || "Uncategorized",
        tvgId: extractAttr(line, "tvg-id"),
        tvgName: extractAttr(line, "tvg-name"),
      };
      pendingOpts = {};
      pendingUrls = inlineUrls;
      continue;
    }

    if (isVlcOpt(line)) {
      pendingOpts = mergeStreamOpts(pendingOpts, parseVlcOpt(line));
      continue;
    }

    if (line.startsWith("#")) continue;

    if (isStreamUrl(line)) {
      pendingUrls.push(line.trim());
    }
  }

  flush();
  return channels;
}

export function isHlsUrl(url: string): boolean {
  return (
    /\.m3u8(\?|$|\/)/i.test(url) ||
    url.includes(".m3u8?") ||
    /\/hls\//i.test(url) ||
    /\/live\/.*\.m3u8/i.test(url)
  );
}

export function isDashUrl(url: string): boolean {
  return /\.mpd(\?|$)/i.test(url);
}
