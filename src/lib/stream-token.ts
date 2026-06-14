export interface StreamProxyContext {
  channelId: string;
  streamIndex: number;
  referer?: string;
  userAgent?: string;
  origin?: string;
  cookie?: string;
}

export function buildChannelStreamUrl(channelId: string, streamIndex: number): string {
  const params = new URLSearchParams({
    channelId,
    streamIndex: String(streamIndex),
  });
  return `/api/stream?${params}`;
}

export function buildStreamProxyPath(ctx: StreamProxyContext, upstreamUrl?: string): string {
  const params = new URLSearchParams({
    channelId: ctx.channelId,
    streamIndex: String(ctx.streamIndex),
  });
  if (upstreamUrl) {
    params.set("url", upstreamUrl);
  }
  return `/api/stream?${params}`;
}
