import { NextRequest, NextResponse } from "next/server";
import { detectManifest, rewriteManifest } from "@/lib/stream-proxy";
import { buildUpstreamHeaders } from "@/lib/stream-headers";
import { resolveLiveStream } from "@/lib/live-stream-resolve";
import {
  DIRECT_STREAM_CHANNEL_ID,
  verifyStreamToken,
  type StreamProxyContext,
} from "@/lib/stream-token";
import { getChannel } from "@/lib/storage";
import type { StreamSource } from "@/lib/types";

async function resolveStreamSource(
  channelId: string,
  streamIndex: number,
  tokenPayload?: {
    url?: string;
    referer?: string;
    userAgent?: string;
  }
): Promise<{ stream: StreamSource; targetUrl: string } | null> {
  if (channelId === DIRECT_STREAM_CHANNEL_ID) {
    const url = tokenPayload?.url;
    if (!url) return null;
    return {
      stream: {
        url,
        referer: tokenPayload.referer,
        userAgent: tokenPayload.userAgent,
      },
      targetUrl: url,
    };
  }

  const channel = await getChannel(channelId);
  if (!channel) return null;

  const stored = channel.streams[streamIndex] ?? channel.streams[0];
  if (!stored?.url) return null;

  const isRootRequest = !tokenPayload?.url;
  const live = isRootRequest ? await resolveLiveStream(channel, streamIndex) : null;
  const base = live ?? stored;

  const stream: StreamSource = {
    url: tokenPayload?.url ?? base.url,
    referer: tokenPayload?.referer ?? base.referer,
    userAgent: tokenPayload?.userAgent ?? base.userAgent,
  };
  const targetUrl = tokenPayload?.url ?? base.url;
  return { stream, targetUrl };
}

function proxyContext(
  channelId: string,
  streamIndex: number,
  stream: Pick<StreamSource, "referer" | "userAgent">
): StreamProxyContext {
  return {
    channelId,
    streamIndex,
    referer: stream.referer,
    userAgent: stream.userAgent,
  };
}

export async function GET(request: NextRequest) {
  const channelId = request.nextUrl.searchParams.get("channelId");
  const streamIndex = Number(request.nextUrl.searchParams.get("streamIndex") ?? "0");
  const token = request.nextUrl.searchParams.get("t");
  const rangeHeader = request.headers.get("range");

  let resolvedChannelId: string;
  let resolvedStreamIndex: number;
  let tokenPayload: {
    url?: string;
    referer?: string;
    userAgent?: string;
  } | undefined;

  if (token) {
    const payload = verifyStreamToken(token);
    if (!payload) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 403 });
    }
    resolvedChannelId = payload.channelId;
    resolvedStreamIndex = payload.streamIndex;
    tokenPayload = {
      url: payload.url,
      referer: payload.referer,
      userAgent: payload.userAgent,
    };
  } else if (channelId) {
    if (!Number.isFinite(streamIndex) || streamIndex < 0) {
      return NextResponse.json({ error: "Invalid streamIndex" }, { status: 400 });
    }
    resolvedChannelId = channelId;
    resolvedStreamIndex = streamIndex;
  } else {
    return NextResponse.json({ error: "Missing channelId or token" }, { status: 400 });
  }

  const resolved = await resolveStreamSource(
    resolvedChannelId,
    resolvedStreamIndex,
    tokenPayload
  );

  if (!resolved) {
    return NextResponse.json({ error: "Stream not found" }, { status: 404 });
  }

  const { stream, targetUrl } = resolved;
  const ctx = proxyContext(resolvedChannelId, resolvedStreamIndex, stream);

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

    // Some IPTV servers redirect to Telegram or other web pages when they
    // detect a browser UA. Detect HTML responses early and return a clear 502
    // so hls.js gets a fatal error instead of silently spinning forever.
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

    const body = new Uint8Array(await upstream.arrayBuffer());

    // Use the final URL after redirects as the base for resolving relative
    // segment paths — the upstream may redirect to a completely different CDN
    // (e.g. bluesport.fun → pscp.tv) whose relative paths would be wrong if
    // we resolved them against the original targetUrl.
    const finalUrl = upstream.url || targetUrl;

    if (detectManifest(finalUrl, contentType, body)) {
      const text = new TextDecoder().decode(body);
      const rewritten = rewriteManifest(text, finalUrl, ctx);

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
