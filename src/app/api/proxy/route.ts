import { NextRequest, NextResponse } from "next/server";
import { rewriteM3U8Content } from "@/lib/proxy-utils";
import { applyStreamProxyHeaders } from "@/lib/stream-headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isManifestUrl(url: string, contentType: string): boolean {
  return (
    url.includes(".m3u8") ||
    contentType.includes("mpegurl") ||
    contentType.includes("application/x-mpegurl")
  );
}

export async function GET(request: NextRequest) {
  const targetUrl = request.nextUrl.searchParams.get("url");
  const userAgent =
    request.nextUrl.searchParams.get("ua") ||
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
  const referer = request.nextUrl.searchParams.get("ref") || undefined;
  const range = request.headers.get("range");

  if (!targetUrl) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  try {
    const upstreamHeaders: Record<string, string> = {
      "User-Agent": userAgent,
      Accept: "*/*",
    };
    if (referer) upstreamHeaders.Referer = referer;
    if (range) upstreamHeaders.Range = range;

    const response = await fetch(targetUrl, {
      headers: upstreamHeaders,
      cache: "no-store",
      redirect: "follow",
    });

    if (!response.ok && response.status !== 206) {
      return NextResponse.json(
        { error: `Upstream error: ${response.status}` },
        { status: response.status }
      );
    }

    const contentType = response.headers.get("content-type") || "";

    if (isManifestUrl(targetUrl, contentType) && !range) {
      const text = await response.text();
      const isManifest =
        text.includes("#EXTM3U") ||
        text.includes("#EXT-X-") ||
        targetUrl.includes(".m3u8");

      if (isManifest) {
        const rewritten = rewriteM3U8Content(text, targetUrl, userAgent, referer);
        const headers = new Headers({
          "Content-Type": "application/vnd.apple.mpegurl",
        });
        applyStreamProxyHeaders(headers);
        return new NextResponse(rewritten, { status: 200, headers });
      }
    }

    const headers = new Headers();
    if (contentType) headers.set("Content-Type", contentType);
    headers.set("Accept-Ranges", "bytes");
    applyStreamProxyHeaders(headers);

    const contentLength = response.headers.get("content-length");
    const contentRange = response.headers.get("content-range");
    if (contentLength) headers.set("Content-Length", contentLength);
    if (contentRange) headers.set("Content-Range", contentRange);

    return new NextResponse(response.body, {
      status: response.status,
      headers,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Proxy failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
