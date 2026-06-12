import { NextRequest, NextResponse } from "next/server";
import { detectManifest, rewriteManifest } from "@/lib/stream-proxy";
import { buildUpstreamHeaders } from "@/lib/stream-headers";
import { verifyStreamToken } from "@/lib/stream-token";
import { getChannel } from "@/lib/storage";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("t");
  const payload = verifyStreamToken(token);

  if (!payload) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 403 });
  }

  const channel = await getChannel(payload.channelId);
  if (!channel) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const stream = channel.streams[payload.streamIndex];
  if (!stream?.url) {
    return NextResponse.json({ error: "Stream not found" }, { status: 404 });
  }

  const upstreamUrl = payload.url ?? stream.url;

  try {
    const upstream = await fetch(upstreamUrl, {
      headers: buildUpstreamHeaders(stream),
      redirect: "follow",
      cache: "no-store",
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream returned ${upstream.status}` },
        { status: upstream.status >= 500 ? 502 : upstream.status }
      );
    }

    const contentType = upstream.headers.get("content-type");
    const body = new Uint8Array(await upstream.arrayBuffer());

    if (detectManifest(upstreamUrl, contentType, body)) {
      const text = new TextDecoder().decode(body);
      const rewritten = rewriteManifest(
        text,
        upstreamUrl,
        payload.channelId,
        payload.streamIndex
      );

      return new NextResponse(rewritten, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Cache-Control": "no-store, no-cache",
        },
      });
    }

    const responseHeaders = new Headers();
    if (contentType) responseHeaders.set("Content-Type", contentType);
    responseHeaders.set("Cache-Control", "no-store, no-cache");

    const contentLength = upstream.headers.get("content-length");
    if (contentLength) responseHeaders.set("Content-Length", contentLength);

    return new NextResponse(body, {
      status: 200,
      headers: responseHeaders,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch stream" }, { status: 502 });
  }
}
