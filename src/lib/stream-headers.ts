import type { StreamSource } from "./types";

export function buildUpstreamHeaders(
  stream: Pick<StreamSource, "userAgent" | "referer">,
  extra?: { range?: string }
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "*/*",
  };

  if (stream.userAgent) {
    headers["User-Agent"] = stream.userAgent;
  }

  if (stream.referer) {
    headers["Referer"] = stream.referer;
  }

  if (extra?.range) {
    headers["Range"] = extra.range;
  }

  return headers;
}
