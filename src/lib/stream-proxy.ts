import { buildStreamProxyPath, type StreamProxyContext } from "./stream-token";

export function resolveStreamUrl(baseUrl: string, relative: string): string {
  const trimmed = relative.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  try {
    return new URL(trimmed, baseUrl).href;
  } catch {
    return trimmed;
  }
}

function isManifest(url: string, contentType: string | null, body: Uint8Array): boolean {
  if (contentType?.includes("mpegurl") || contentType?.includes("m3u")) return true;
  if (url.includes(".m3u8") || url.includes(".m3u")) return true;
  const head = new TextDecoder().decode(body.slice(0, 32));
  return head.startsWith("#EXTM3U");
}

function rewriteUriInTag(
  line: string,
  baseUrl: string,
  ctx: StreamProxyContext
): string {
  return line.replace(/URI="([^"]+)"/gi, (_match, uri: string) => {
    const absolute = resolveStreamUrl(baseUrl, uri);
    return `URI="${buildStreamProxyPath(ctx, absolute)}"`;
  });
}

export function rewriteManifest(
  manifestText: string,
  baseUrl: string,
  ctx: StreamProxyContext
): string {
  return manifestText
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith("#")) {
        return rewriteUriInTag(line, baseUrl, ctx);
      }
      const absolute = resolveStreamUrl(baseUrl, trimmed);
      return buildStreamProxyPath(ctx, absolute);
    })
    .join("\n");
}

export function detectManifest(
  url: string,
  contentType: string | null,
  body: Uint8Array
): boolean {
  return isManifest(url, contentType, body);
}
