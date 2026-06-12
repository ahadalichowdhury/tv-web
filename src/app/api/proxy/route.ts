import { NextRequest, NextResponse } from "next/server";
import { rewriteM3U8Content } from "@/lib/proxy-utils";

function isManifestCandidate(url: string, contentType: string): boolean {
  return (
    url.includes(".m3u8") ||
    contentType.includes("mpegurl") ||
    contentType.includes("m3u") ||
    contentType.includes("text/plain")
  );
}

export async function GET(request: NextRequest) {
  const targetUrl = request.nextUrl.searchParams.get("url");
  const userAgent =
    request.nextUrl.searchParams.get("ua") ||
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
  const referer = request.nextUrl.searchParams.get("ref") || undefined;

  if (!targetUrl) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  try {
    const headers: Record<string, string> = {
      "User-Agent": userAgent,
      Accept: "*/*",
    };
    if (referer) headers.Referer = referer;

    const response = await fetch(targetUrl, {
      headers,
      cache: "no-store",
      redirect: "follow",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Upstream error: ${response.status}` },
        { status: response.status }
      );
    }

    const contentType = response.headers.get("content-type") || "";
    const bodyPreview = isManifestCandidate(targetUrl, contentType)
      ? await response.text()
      : null;

    const isManifest =
      bodyPreview !== null &&
      (bodyPreview.includes("#EXTM3U") ||
        bodyPreview.includes("#EXT-X-") ||
        targetUrl.includes(".m3u8") ||
        contentType.includes("mpegurl") ||
        contentType.includes("m3u"));

    if (isManifest && bodyPreview !== null) {
      const rewritten = rewriteM3U8Content(bodyPreview, targetUrl, userAgent, referer);
      return new NextResponse(rewritten, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-cache",
        },
      });
    }

    if (bodyPreview !== null) {
      return new NextResponse(bodyPreview, {
        status: 200,
        headers: {
          "Content-Type": contentType || "text/plain",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    const buffer = await response.arrayBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType || "application/octet-stream",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Proxy failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
