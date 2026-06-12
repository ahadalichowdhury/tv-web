import type { Channel, PublicChannel } from "./types";
import { isYoutubeUrl } from "./youtube";

export function toPublicChannel(channel: Channel): PublicChannel {
  return {
    id: channel.id,
    playlistId: channel.playlistId,
    name: channel.name,
    logo: channel.logo,
    group: channel.group,
    tvgId: channel.tvgId,
    tvgName: channel.tvgName,
    streams: channel.streams.map((s) => ({
      type: s.type ?? (isYoutubeUrl(s.url) ? "youtube" : "hls"),
    })),
    createdAt: channel.createdAt,
  };
}

export function toPublicChannels(channels: Channel[]): PublicChannel[] {
  return channels.map(toPublicChannel);
}
