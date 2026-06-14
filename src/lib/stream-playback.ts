import { buildChannelStreamUrl } from "./stream-token";
import type { Channel, StreamSource } from "./types";

/** Private/LAN hosts only reachable from the homelab network — must use server proxy. */
export function isLocalOnlyUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    const host = hostname.toLowerCase();

    if (host === "localhost" || host.endsWith(".local")) return true;

    const parts = host.split(".").map(Number);
    if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) {
      return false;
    }

    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 127) return true;

    return false;
  } catch {
    return false;
  }
}

/** Streams that need the server proxy (BDIX, custom headers, DRM license via rewrite). */
export function needsStreamProxy(stream: StreamSource | undefined): boolean {
  if (!stream?.url) return true;

  const url = stream.url.split("|")[0].trim();
  if (isLocalOnlyUrl(url)) return true;

  if (stream.userAgent || stream.referer || stream.origin || stream.cookie) return true;
  if (stream.extraHeaders && Object.keys(stream.extraHeaders).length > 0) return true;

  return false;
}

export interface PlaybackUrls {
  /** URL passed to the player first (CDN direct or proxy). */
  playUrl: string;
  /** Server proxy path — used as fallback when direct play fails. */
  proxyUrl: string;
  /** True when the player hits the CDN directly (HesGoal-style). */
  direct: boolean;
}

export function resolvePlaybackUrl(channel: Channel, streamIndex: number): PlaybackUrls {
  const stream = channel.streams[streamIndex] ?? channel.streams[0];
  const cleanUrl = stream?.url?.split("|")[0].trim() ?? "";
  const proxyUrl = buildChannelStreamUrl(channel.id, streamIndex);

  if (!cleanUrl || needsStreamProxy(stream)) {
    return { playUrl: proxyUrl, proxyUrl, direct: false };
  }

  return { playUrl: cleanUrl, proxyUrl, direct: true };
}
