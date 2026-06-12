export interface StreamSource {
  url: string;
  type?: "hls" | "youtube";
  userAgent?: string;
  referer?: string;
}

export interface Channel {
  id: string;
  playlistId: string;
  name: string;
  logo?: string;
  group: string;
  tvgId?: string;
  tvgName?: string;
  streams: StreamSource[];
  createdAt: string;
}

export interface Playlist {
  id: string;
  name: string;
  sourceType: "url" | "file";
  sourceUrl?: string;
  createdAt: string;
  updatedAt: string;
  channelCount: number;
}

export interface ParsedChannel {
  name: string;
  logo?: string;
  group: string;
  tvgId?: string;
  tvgName?: string;
  streams: StreamSource[];
}

export interface DataStore {
  playlists: Playlist[];
  channels: Channel[];
}
