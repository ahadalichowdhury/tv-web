import { isDashUrl, isHlsUrl } from "./m3u-parser";
import { isYoutubeUrl } from "./youtube";

export type StreamKind = "hls" | "dash" | "progressive" | "youtube" | "unknown";

const PROGRESSIVE_PATTERN = /\.(mp4|webm|ogg|ogv|mov|m4v|mkv|mp3|aac|flac)(\?|$)/i;

export function detectStreamKind(url: string): StreamKind {
  if (isYoutubeUrl(url)) return "youtube";
  if (isHlsUrl(url)) return "hls";
  if (isDashUrl(url)) return "dash";
  if (PROGRESSIVE_PATTERN.test(url)) return "progressive";
  // Most IPTV network URLs are HLS even without .m3u8 in the path
  if (/^https?:\/\//i.test(url)) return "hls";
  return "unknown";
}

export function isProgressiveUrl(url: string): boolean {
  return detectStreamKind(url) === "progressive";
}
