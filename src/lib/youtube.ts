const YOUTUBE_PATTERNS = [
  /(?:youtube\.com\/watch\?(?:.*&)?v=|youtube\.com\/watch\?v=)([\w-]{11})/i,
  /youtube\.com\/live\/([\w-]{11})/i,
  /youtube\.com\/embed\/([\w-]{11})/i,
  /youtube\.com\/shorts\/([\w-]{11})/i,
  /youtu\.be\/([\w-]{11})/i,
];

export function extractYoutubeVideoId(url: string): string | null {
  const trimmed = url.trim();
  for (const pattern of YOUTUBE_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

export function isYoutubeUrl(url: string): boolean {
  return extractYoutubeVideoId(url) !== null;
}

export function getYoutubeThumbnail(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

export function getYoutubeProxyStreamUrl(videoId: string): string {
  return `/api/yt-stream?id=${encodeURIComponent(videoId)}`;
}

export function getYoutubeEmbedUrl(videoId: string, autoplay = true): string {
  const params = new URLSearchParams({
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
  });
  if (autoplay) params.set("autoplay", "1");
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

export function isYoutubeStream(stream?: {
  url: string;
  type?: string;
}): boolean {
  if (!stream) return false;
  if (stream.type === "youtube") return true;
  return isYoutubeUrl(stream.url);
}
