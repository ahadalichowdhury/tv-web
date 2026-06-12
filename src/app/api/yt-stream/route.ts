import { NextRequest } from "next/server";
import { isHlsUrl } from "@/lib/m3u-parser";
import { rewriteM3U8Content } from "@/lib/proxy-utils";
import {
  clearYoutubeStreamCache,
  extractYoutubeStreamUrl,
} from "@/lib/yt-extract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get("id");

  if (!videoId || !/^[\w-]{11}$/.test(videoId)) {
    return new Response("Missing or invalid video ID", { status: 400 });
  }

  try {
    const directUrl = await extractYoutubeStreamUrl(videoId);
    const range = request.headers.get("range");
    const isManifest = isHlsUrl(directUrl);

    const upstreamHeaders: Record<string, string> = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "*/*",
    };

    if (isManifest && !range) {
      const manifestRes = await fetch(directUrl, {
        headers: upstreamHeaders,
        cache: "no-store",
      });
      if (!manifestRes.ok) {
        clearYoutubeStreamCache(videoId);
        return new Response(`Manifest error: ${manifestRes.status}`, {
          status: manifestRes.status,
        });
      }
      const text = await manifestRes.text();
      const rewritten = rewriteM3U8Content(text, directUrl);
      return new Response(rewritten, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-store",
        },
      });
    }

    if (range) upstreamHeaders.Range = range;

    const upstream = await fetch(directUrl, {
      headers: upstreamHeaders,
      cache: "no-store",
      redirect: "follow",
    });

    if (!upstream.ok && upstream.status !== 206) {
      clearYoutubeStreamCache(videoId);
      return new Response(`Upstream error: ${upstream.status}`, {
        status: upstream.status,
      });
    }

    const headers = new Headers();
    const contentType = upstream.headers.get("content-type");
    if (contentType) headers.set("Content-Type", contentType);
    headers.set("Accept-Ranges", "bytes");
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Cache-Control", "no-store");

    const contentLength = upstream.headers.get("content-length");
    const contentRange = upstream.headers.get("content-range");
    if (contentLength) headers.set("Content-Length", contentLength);
    if (contentRange) headers.set("Content-Range", contentRange);

    return new Response(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stream extraction failed";
    return new Response(message, { status: 500 });
  }
}
