import type { StreamSource } from "./types";

// Many IPTV stream servers block requests that look like browsers (Mozilla/Chrome/Safari)
// and redirect to Telegram or other pages instead. Using a media-player UA
// (Lavf = FFmpeg's libavformat) bypasses these checks and returns the actual stream.
// This must NOT contain "Mozilla", "Chrome", "Safari" or similar browser strings.
const DEFAULT_MEDIA_UA = "Lavf/60.3.100";

export function buildUpstreamHeaders(
  stream: Pick<StreamSource, "userAgent" | "referer" | "origin" | "cookie" | "extraHeaders">,
  extra?: { range?: string }
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "*/*",
    "User-Agent": stream.userAgent || DEFAULT_MEDIA_UA,
  };

  if (stream.referer) headers["Referer"] = stream.referer;
  if (stream.origin) headers["Origin"] = stream.origin;
  if (stream.cookie) headers["Cookie"] = stream.cookie;

  if (stream.extraHeaders) {
    for (const [k, v] of Object.entries(stream.extraHeaders)) {
      headers[k] = v;
    }
  }

  if (extra?.range) headers["Range"] = extra.range;

  return headers;
}
