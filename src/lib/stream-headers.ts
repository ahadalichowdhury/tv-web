import type { StreamSource } from "./types";

export function buildUpstreamHeaders(stream: StreamSource): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "*/*",
  };

  if (stream.userAgent) {
    headers["User-Agent"] = stream.userAgent;
  }

  if (stream.referer) {
    headers["Referer"] = stream.referer;
  }

  return headers;
}
