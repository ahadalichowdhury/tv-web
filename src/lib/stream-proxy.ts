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

// ---------------------------------------------------------------------------
// Manifest type detection
// ---------------------------------------------------------------------------

function isMpd(url: string, contentType: string | null, body: Uint8Array): boolean {
  if (contentType?.includes("dash+xml") || contentType?.includes("mpd")) return true;
  if (url.includes(".mpd")) return true;
  const head = new TextDecoder().decode(body.slice(0, 128));
  return head.includes("<MPD") || head.includes("urn:mpeg:dash");
}

function isM3u(url: string, contentType: string | null, body: Uint8Array): boolean {
  if (contentType?.includes("mpegurl") || contentType?.includes("m3u")) return true;
  if (url.includes(".m3u8") || url.includes(".m3u")) return true;
  const head = new TextDecoder().decode(body.slice(0, 32));
  return head.startsWith("#EXTM3U");
}

export function detectManifest(
  url: string,
  contentType: string | null,
  body: Uint8Array
): "hls" | "dash" | false {
  if (isMpd(url, contentType, body)) return "dash";
  if (isM3u(url, contentType, body)) return "hls";
  return false;
}

// ---------------------------------------------------------------------------
// HLS manifest rewriting  (line-by-line)
// ---------------------------------------------------------------------------

function rewriteUriInTag(line: string, baseUrl: string, ctx: StreamProxyContext): string {
  return line.replace(/URI="([^"]+)"/gi, (_match, uri: string) => {
    const absolute = resolveStreamUrl(baseUrl, uri);
    return `URI="${buildStreamProxyPath(ctx, absolute)}"`;
  });
}

export function rewriteHlsManifest(
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

// ---------------------------------------------------------------------------
// DASH / MPD manifest rewriting
//
// Strategy: rewrite every absolute URL we can find inside the XML text.
// This handles <BaseURL>, sourceURL=, media=, initialization= attributes
// and avoids the need for a full XML parser.
// Relative URLs inside <SegmentTemplate> templates (containing $Number$ etc.)
// are left as-is — dash.js will resolve them against the (already-proxied)
// BaseURL that we rewrote.
// ---------------------------------------------------------------------------

function rewriteMpdUrl(raw: string, baseUrl: string, ctx: StreamProxyContext): string {
  // Only rewrite absolute http(s) URLs; leave relative paths and templates.
  if (!/^https?:\/\//i.test(raw.trim())) return raw;
  return buildStreamProxyPath(ctx, raw.trim());
}

/**
 * Rewrite a DASH MPD XML string so that all absolute HTTP(S) URLs inside it
 * are replaced with signed proxy paths.  Handles:
 *  - <BaseURL>https://...</BaseURL>
 *  - sourceURL="https://..."
 *  - media="https://..."
 *  - initialization="https://..."
 */
export function rewriteDashManifest(
  mpdText: string,
  baseUrl: string,
  ctx: StreamProxyContext
): string {
  // 1. Rewrite <BaseURL>url</BaseURL> element content
  let result = mpdText.replace(
    /(<BaseURL[^>]*>)([\s\S]*?)(<\/BaseURL>)/gi,
    (_match, open: string, url: string, close: string) => {
      const absolute = resolveStreamUrl(baseUrl, url.trim());
      return `${open}${rewriteMpdUrl(absolute, baseUrl, ctx)}${close}`;
    }
  );

  // 2. Rewrite XML attributes containing absolute https?:// URLs
  //    Covers: sourceURL, media, initialization, href
  result = result.replace(
    /((?:sourceURL|media|initialization|href)=")(https?:\/\/[^"]*?)(")/gi,
    (_match, attr: string, url: string, close: string) => {
      return `${attr}${rewriteMpdUrl(url, baseUrl, ctx)}${close}`;
    }
  );

  return result;
}

// Legacy export kept for compatibility
export function rewriteManifest(
  manifestText: string,
  baseUrl: string,
  ctx: StreamProxyContext
): string {
  return rewriteHlsManifest(manifestText, baseUrl, ctx);
}
