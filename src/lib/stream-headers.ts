import type { StreamSource } from "./types";

// Many IPTV stream servers block browser or server-side fetch User-Agents and
// redirect to unrelated pages (e.g. Telegram). Using a well-known media player
// UA causes them to return the actual stream instead.
const DEFAULT_MEDIA_UA =
  "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36 NSPlayer/7.0";

export function buildUpstreamHeaders(
  stream: Pick<StreamSource, "userAgent" | "referer">,
  extra?: { range?: string }
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "*/*",
    "User-Agent": stream.userAgent || DEFAULT_MEDIA_UA,
  };

  if (stream.referer) {
    headers["Referer"] = stream.referer;
  }

  if (extra?.range) {
    headers["Range"] = extra.range;
  }

  return headers;
}
