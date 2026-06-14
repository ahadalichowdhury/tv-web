import { NextRequest, NextResponse } from "next/server";
import { detectManifest, rewriteHlsManifest, rewriteDashManifest } from "@/lib/stream-proxy";
import { buildUpstreamHeaders } from "@/lib/stream-headers";
import { resolveLiveStream } from "@/lib/live-stream-resolve";
import type { StreamProxyContext } from "@/lib/stream-token";
import { getChannel } from "@/lib/storage";
import type { StreamSource } from "@/lib/types";

async function resolveStreamSource(
  channelId: string,
  streamIndex: number,
  segmentUrl?: string
): Promise<{ stream: StreamSource; targetUrl: string } | null> {
  const channel = await getChannel(channelId);
  if (!channel) return null;

  const stored = channel.streams[streamIndex] ?? channel.streams[0];
  if (!stored?.url) return null;

  const isRootRequest = !segmentUrl;
  const live = isRootRequest ? await resolveLiveStream(channel, streamIndex) : null;
  const base = live ?? stored;

  const stream: StreamSource = {
    url: segmentUrl ?? base.url,
    referer: base.referer,
    userAgent: base.userAgent,
    origin: base.origin,
    cookie: base.cookie,
    extraHeaders: base.extraHeaders,
  };
  const targetUrl = segmentUrl ?? base.url;
  return { stream, targetUrl };
}

function proxyContext(
  channelId: string,
  streamIndex: number,
  stream: Pick<StreamSource, "referer" | "userAgent" | "origin" | "cookie">
): StreamProxyContext {
  return {
    channelId,
    streamIndex,
    referer: stream.referer,
    userAgent: stream.userAgent,
    origin: stream.origin,
    cookie: stream.cookie,
  };
}

export async function GET(request: NextRequest) {
  const channelId = request.nextUrl.searchParams.get("channelId");
  const streamIndex = Number(request.nextUrl.searchParams.get("streamIndex") ?? "0");
  const segmentUrl = request.nextUrl.searchParams.get("url") ?? undefined;
  const rangeHeader = request.headers.get("range");

  if (!channelId) {
    return NextResponse.json({ error: "Missing channelId" }, { status: 400 });
  }

  if (!Number.isFinite(streamIndex) || streamIndex < 0) {
    return NextResponse.json({ error: "Invalid streamIndex" }, { status: 400 });
  }

  const resolved = await resolveStreamSource(channelId, streamIndex, segmentUrl);

  if (!resolved) {
    return NextResponse.json({ error: "Stream not found" }, { status: 404 });
  }

  const { stream, targetUrl } = resolved;
  const ctx = proxyContext(channelId, streamIndex, stream);

  try {
    const upstream = await fetch(targetUrl, {
      headers: buildUpstreamHeaders(stream, { range: rangeHeader ?? undefined }),
      redirect: "follow",
      cache: "no-store",
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream returned ${upstream.status}` },
        { status: upstream.status >= 500 ? 502 : upstream.status }
      );
    }

    const contentType = upstream.headers.get("content-type") ?? "";

    if (contentType.startsWith("text/html")) {
      return NextResponse.json(
        { error: "Stream blocked — server returned a web page instead of a stream (may be IP-restricted, expired, or UA-blocked)" },
        { status: 502 }
      );
    }

    if (rangeHeader && upstream.status === 206) {
      const responseHeaders = new Headers();
      if (contentType) responseHeaders.set("Content-Type", contentType);
      const contentRange = upstream.headers.get("content-range");
      const contentLength = upstream.headers.get("content-length");
      if (contentRange) responseHeaders.set("Content-Range", contentRange);
      if (contentLength) responseHeaders.set("Content-Length", contentLength);
      responseHeaders.set("Accept-Ranges", "bytes");
      responseHeaders.set("Cache-Control", "no-store, no-cache");
      return new NextResponse(upstream.body, { status: 206, headers: responseHeaders });
    }

    // Segment/key requests — pipe through without buffering multi-MB .ts files.
    const isBinarySegment =
      Boolean(segmentUrl) ||
      contentType.startsWith("video/") ||
      contentType.startsWith("audio/") ||
      contentType.includes("octet-stream");
    if (isBinarySegment && upstream.body) {
      const responseHeaders = new Headers();
      if (contentType) responseHeaders.set("Content-Type", contentType);
      responseHeaders.set("Cache-Control", "no-store, no-cache");
      responseHeaders.set("Accept-Ranges", "bytes");
      const contentLength = upstream.headers.get("content-length");
      if (contentLength) responseHeaders.set("Content-Length", contentLength);
      return new NextResponse(upstream.body, { headers: responseHeaders });
    }

    const body = new Uint8Array(await upstream.arrayBuffer());
    const finalUrl = upstream.url || targetUrl;

    const manifestType = detectManifest(finalUrl, contentType, body);
    if (manifestType) {
      const text = new TextDecoder().decode(body);

      if (manifestType === "dash") {
        const rewritten = rewriteDashManifest(text, finalUrl, ctx);
        return new NextResponse(rewritten, {
          headers: {
            "Content-Type": "application/dash+xml",
            "Cache-Control": "no-store, no-cache",
          },
        });
      }

      const rewritten = rewriteHlsManifest(text, finalUrl, ctx);
      return new NextResponse(rewritten, {
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Cache-Control": "no-store, no-cache",
        },
      });
    }

    const responseHeaders = new Headers();
    if (contentType) responseHeaders.set("Content-Type", contentType);
    responseHeaders.set("Cache-Control", "no-store, no-cache");
    responseHeaders.set("Accept-Ranges", "bytes");
    const contentLength = upstream.headers.get("content-length");
    if (contentLength) responseHeaders.set("Content-Length", contentLength);

    return new NextResponse(body, { headers: responseHeaders });
  } catch {
    return NextResponse.json({ error: "Failed to fetch stream" }, { status: 502 });
  }
}
