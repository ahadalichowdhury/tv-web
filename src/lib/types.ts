export interface StreamSource {
  url: string;
  /** Detected or forced stream type */
  type?: "hls" | "dash" | "youtube" | "progressive";
  userAgent?: string;
  referer?: string;
  /** HTTP Origin header */
  origin?: string;
  /** HTTP Cookie header */
  cookie?: string;
  /** Any extra custom headers (key:value pairs) */
  extraHeaders?: Record<string, string>;
  /**
   * ClearKey DRM — inline format: "keyId:key" (hex, colon-separated)
   * or a JSON ClearKey object string.
   */
  clearKey?: string;
  /** ClearKey license server URL (alternative to inline clearKey) */
  clearKeyUrl?: string;
  /** Widevine license server URL */
  widevineUrl?: string;
  /** PlayReady license server URL */
  playreadyUrl?: string;
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
