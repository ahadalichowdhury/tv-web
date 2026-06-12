import { buildStreamProxyPath } from "./stream-token";

export function resolveStreamUrl(baseUrl: string, relative: string): string {
  const trimmed = relative.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  try {
    return new URL(trimmed, baseUrl).href;
  } catch {
    return trimmed;
  }
}

function isManifestContent(url: string, contentType: string | null, body: Uint8Array): boolean {
  if (contentType?.includes("mpegurl") || contentType?.includes("m3u")) return true;
  if (url.includes(".m3u8") || url.includes(".m3u")) return true;

  const head = new TextDecoder().decode(body.slice(0, 32));
  return head.startsWith("#EXTM3U");
}

function rewriteUriInTag(
  line: string,
  baseUrl: string,
  channelId: string,
  streamIndex: number
): string {
  return line.replace(/URI="([^"]+)"/gi, (_match, uri: string) => {
    const absolute = resolveStreamUrl(baseUrl, uri);
    const proxyPath = buildStreamProxyPath(channelId, streamIndex, absolute);
    return `URI="${proxyPath}"`;
  });
}

export function rewriteManifest(
  manifestText: string,
  baseUrl: string,
  channelId: string,
  streamIndex: number
): string {
  const lines = manifestText.split(/\r?\n/);

  return lines
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      if (trimmed.startsWith("#")) {
        return rewriteUriInTag(line, baseUrl, channelId, streamIndex);
      }

      const absolute = resolveStreamUrl(baseUrl, trimmed);
      return buildStreamProxyPath(channelId, streamIndex, absolute);
    })
    .join("\n");
}

export function detectManifest(
  url: string,
  contentType: string | null,
  body: Uint8Array
): boolean {
  return isManifestContent(url, contentType, body);
}
