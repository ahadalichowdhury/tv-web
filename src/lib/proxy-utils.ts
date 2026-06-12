const URL_PATTERN = /https?:\/\/[^\s"'<>]+/gi;

export function buildProxyUrl(
  targetUrl: string,
  userAgent?: string,
  referer?: string,
  basePath = "/api/proxy"
): string {
  const params = new URLSearchParams({ url: targetUrl });
  if (userAgent) params.set("ua", userAgent);
  if (referer) params.set("ref", referer);
  return `${basePath}?${params.toString()}`;
}

export function rewriteM3U8Content(
  content: string,
  baseUrl: string,
  userAgent?: string,
  referer?: string
): string {
  const base = new URL(baseUrl);

  return content
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        if (trimmed.startsWith("#") && trimmed.includes("URI=")) {
          return trimmed.replace(/URI="([^"]+)"/g, (_, uri: string) => {
            const absolute = resolveUrl(uri, base);
            return `URI="${buildProxyUrl(absolute, userAgent, referer)}"`;
          });
        }
        return line;
      }

      const absolute = resolveUrl(trimmed, base);
      return buildProxyUrl(absolute, userAgent, referer);
    })
    .join("\n");
}

export function resolveUrl(relative: string, base: URL): string {
  try {
    return new URL(relative, base).href;
  } catch {
    return relative;
  }
}

export function extractUrlsFromText(text: string): string[] {
  return [...text.matchAll(URL_PATTERN)].map((m) => m[0]);
}
