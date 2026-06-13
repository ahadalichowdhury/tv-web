import type { ParsedChannel, StreamSource } from "./types";

const URL_PATTERN = /https?:\/\/[^\s"'<>|]+/gi;

// ---------------------------------------------------------------------------
// Attribute helpers
// ---------------------------------------------------------------------------

function extractAttr(line: string, key: string): string | undefined {
  const regex = new RegExp(`${key}="([^"]*)"`, "i");
  const match = line.match(regex);
  return match?.[1]?.trim() || undefined;
}

function extractChannelName(line: string): string {
  const commaIdx = line.lastIndexOf(",");
  if (commaIdx === -1) return "Unknown Channel";
  let namePart = line.slice(commaIdx + 1).trim();
  // Strip any inline URLs embedded in the name part
  namePart = namePart.replace(/https?:\/\/[^\s"'<>|]+(\|[^\s"'<>]*)?/gi, "").trim();
  return namePart || "Unknown Channel";
}

function extractInlineUrlsFromName(line: string): string[] {
  const commaIdx = line.lastIndexOf(",");
  if (commaIdx === -1) return [];
  const namePart = line.slice(commaIdx + 1);
  return [...namePart.matchAll(/https?:\/\/[^\s"'<>|]+/gi)].map((m) => m[0].trim());
}

// ---------------------------------------------------------------------------
// Pipe-header URL parsing  (NS Player / VLC style)
//
// Format:  https://stream.url/video.m3u8|User-Agent=Lavf/60.3&Referer=https://x.com/
// Keys:    User-Agent, Referer, Referrer, Origin, Cookie, plus arbitrary custom headers
// ---------------------------------------------------------------------------

function parsePipeHeaders(raw: string): { url: string; opts: Partial<StreamSource> } {
  const pipeIdx = raw.indexOf("|");
  if (pipeIdx === -1) return { url: raw.trim(), opts: {} };

  const url = raw.slice(0, pipeIdx).trim();
  const headerStr = raw.slice(pipeIdx + 1);
  const opts: Partial<StreamSource> = {};
  const extra: Record<string, string> = {};

  for (const pair of headerStr.split("&")) {
    const eqIdx = pair.indexOf("=");
    if (eqIdx === -1) continue;
    const key = pair.slice(0, eqIdx).trim();
    const val = decodeURIComponent(pair.slice(eqIdx + 1).trim());
    const lkey = key.toLowerCase();

    if (lkey === "user-agent" || lkey === "useragent") {
      opts.userAgent = val;
    } else if (lkey === "referer" || lkey === "referrer") {
      opts.referer = val;
    } else if (lkey === "origin") {
      opts.origin = val;
    } else if (lkey === "cookie" || lkey === "cookies") {
      opts.cookie = val;
    } else if (lkey === "license_key" || lkey === "clearkeys") {
      opts.clearKey = val;
    } else if (lkey === "license_url") {
      opts.clearKeyUrl = val;
    } else {
      extra[key] = val;
    }
  }

  if (Object.keys(extra).length > 0) opts.extraHeaders = extra;
  return { url, opts };
}

// ---------------------------------------------------------------------------
// #EXTVLCOPT parser
// ---------------------------------------------------------------------------

function isVlcOpt(line: string): boolean {
  return /^#?EXTVLCOPT:/i.test(line.trim());
}

function parseVlcOpt(line: string): Partial<StreamSource> {
  const normalized = line.trim().replace(/^#?EXTVLCOPT:/i, "");
  const lnorm = normalized.toLowerCase();
  if (lnorm.startsWith("http-user-agent=")) {
    return { userAgent: normalized.slice("http-user-agent=".length).trim() };
  }
  if (lnorm.startsWith("http-referr") && lnorm.includes("=")) {
    return { referer: normalized.replace(/^http-referr(?:er|rer)=/i, "").trim() };
  }
  if (lnorm.startsWith("http-origin=")) {
    return { origin: normalized.slice("http-origin=".length).trim() };
  }
  if (lnorm.startsWith("http-cookie=")) {
    return { cookie: normalized.slice("http-cookie=".length).trim() };
  }
  return {};
}

// ---------------------------------------------------------------------------
// #EXTHTTP parser  — JSON header object on a single line
//
// Format: #EXTHTTP:{"User-Agent":"Lavf/60.3","Referer":"https://example.com"}
// ---------------------------------------------------------------------------

function isExtHttp(line: string): boolean {
  return /^#EXTHTTP:/i.test(line.trim());
}

function parseExtHttp(line: string): Partial<StreamSource> {
  try {
    const json = line.trim().replace(/^#EXTHTTP:/i, "");
    const obj = JSON.parse(json) as Record<string, string>;
    const opts: Partial<StreamSource> = {};
    const extra: Record<string, string> = {};

    for (const [k, v] of Object.entries(obj)) {
      const lk = k.toLowerCase();
      if (lk === "user-agent") opts.userAgent = v;
      else if (lk === "referer" || lk === "referrer") opts.referer = v;
      else if (lk === "origin") opts.origin = v;
      else if (lk === "cookie" || lk === "cookies") opts.cookie = v;
      else extra[k] = v;
    }

    if (Object.keys(extra).length > 0) opts.extraHeaders = extra;
    return opts;
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// #KODIPROP parser  — Kodi / Kodi-style stream properties
//
// Common properties:
//   inputstream.adaptive.license_type=clearkey|widevine|playready
//   inputstream.adaptive.license_key=keyId:key  (clearkey inline)
//   inputstream.adaptive.license_key=https://...  (license server)
//   mimetype=application/dash+xml
//   inputstream.adaptive.manifest_type=mpd
// ---------------------------------------------------------------------------

function isKodiProp(line: string): boolean {
  return /^#KODIPROP:/i.test(line.trim());
}

function parseKodiProp(
  line: string,
  acc: Partial<StreamSource> & { _kodiLicenseType?: string }
): Partial<StreamSource> & { _kodiLicenseType?: string } {
  const kv = line.trim().replace(/^#KODIPROP:/i, "");
  const eqIdx = kv.indexOf("=");
  if (eqIdx === -1) return acc;
  const key = kv.slice(0, eqIdx).trim().toLowerCase();
  const val = kv.slice(eqIdx + 1).trim();

  if (key === "inputstream.adaptive.license_type") {
    return { ...acc, _kodiLicenseType: val.toLowerCase() };
  }

  if (key === "inputstream.adaptive.license_key") {
    const lt = acc._kodiLicenseType ?? "";
    if (lt === "clearkey") {
      // Inline: keyId:key  or just a server URL
      if (val.includes(":") && !val.startsWith("http")) {
        return { ...acc, clearKey: val };
      }
      return { ...acc, clearKeyUrl: val };
    }
    if (lt === "widevine") return { ...acc, widevineUrl: val };
    if (lt === "playready") return { ...acc, playreadyUrl: val };
    // Fallback: try clearkey inline
    return { ...acc, clearKey: val };
  }

  if (key === "mimetype") {
    if (val.includes("dash") || val.includes("mpd")) return { ...acc, type: "dash" };
    if (val.includes("mpegurl") || val.includes("m3u")) return { ...acc, type: "hls" };
  }

  if (key === "inputstream.adaptive.manifest_type") {
    if (val === "mpd") return { ...acc, type: "dash" };
    if (val === "hls") return { ...acc, type: "hls" };
  }

  return acc;
}

// ---------------------------------------------------------------------------
// Merge helper
// ---------------------------------------------------------------------------

function mergeOpts(
  base: Partial<StreamSource>,
  extra: Partial<StreamSource>
): Partial<StreamSource> {
  const merged: Partial<StreamSource> = { ...base };
  if (extra.userAgent) merged.userAgent = extra.userAgent;
  if (extra.referer) merged.referer = extra.referer;
  if (extra.origin) merged.origin = extra.origin;
  if (extra.cookie) merged.cookie = extra.cookie;
  if (extra.clearKey) merged.clearKey = extra.clearKey;
  if (extra.clearKeyUrl) merged.clearKeyUrl = extra.clearKeyUrl;
  if (extra.widevineUrl) merged.widevineUrl = extra.widevineUrl;
  if (extra.playreadyUrl) merged.playreadyUrl = extra.playreadyUrl;
  if (extra.type) merged.type = extra.type;
  if (extra.extraHeaders) {
    merged.extraHeaders = { ...base.extraHeaders, ...extra.extraHeaders };
  }
  return merged;
}

// ---------------------------------------------------------------------------
// Finalize a channel
// ---------------------------------------------------------------------------

type KodiAcc = Partial<StreamSource> & { _kodiLicenseType?: string };

function finalizeChannel(
  meta: Omit<ParsedChannel, "streams">,
  pendingOpts: KodiAcc,
  urls: string[]
): ParsedChannel | null {
  const uniqueUrls = [...new Set(urls.filter(Boolean))];
  if (uniqueUrls.length === 0) return null;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _kodiLicenseType, ...cleanOpts } = pendingOpts;

  const streams: StreamSource[] = uniqueUrls.map((rawUrl) => {
    // Apply pipe headers embedded in the URL itself
    const { url, opts: pipeOpts } = parsePipeHeaders(rawUrl);
    const merged = mergeOpts(cleanOpts, pipeOpts);
    return { url, ...merged };
  });

  return { ...meta, streams };
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

export function parseM3U(content: string): ParsedChannel[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const channels: ParsedChannel[] = [];

  let pendingMeta: Omit<ParsedChannel, "streams"> | null = null;
  let pendingOpts: KodiAcc = {};
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
      pendingOpts = mergeOpts(pendingOpts, parseVlcOpt(line)) as KodiAcc;
      continue;
    }

    if (isExtHttp(line)) {
      pendingOpts = mergeOpts(pendingOpts, parseExtHttp(line)) as KodiAcc;
      continue;
    }

    if (isKodiProp(line)) {
      pendingOpts = parseKodiProp(line, pendingOpts);
      continue;
    }

    if (line.startsWith("#")) continue;

    // Stream URL (possibly with pipe headers)
    const trimmed = line.trim();
    if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("/")) {
      pendingUrls.push(trimmed);
    }
  }

  flush();
  return channels;
}

// ---------------------------------------------------------------------------
// URL type detection helpers
// ---------------------------------------------------------------------------

export function isHlsUrl(url: string): boolean {
  // Strip pipe headers before checking
  const base = url.split("|")[0];
  return (
    /\.m3u8(\?|$|\/)/i.test(base) ||
    base.includes(".m3u8?") ||
    /\/hls\//i.test(base) ||
    /\/live\/.*\.m3u8/i.test(base)
  );
}

export function isDashUrl(url: string): boolean {
  const base = url.split("|")[0];
  return /\.mpd(\?|$)/i.test(base);
}
