import { promises as fs } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import type { Channel, DataStore, ParsedChannel, Playlist } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "store.json");

const EMPTY_STORE: DataStore = { playlists: [], channels: [] };

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readStore(): Promise<DataStore> {
  await ensureDataDir();
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    return JSON.parse(raw) as DataStore;
  } catch {
    return { ...EMPTY_STORE };
  }
}

async function writeStore(store: DataStore) {
  await ensureDataDir();
  await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2), "utf-8");
}

export async function getPlaylists(): Promise<Playlist[]> {
  const store = await readStore();
  return store.playlists.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export async function getPlaylist(id: string): Promise<Playlist | undefined> {
  const store = await readStore();
  return store.playlists.find((p) => p.id === id);
}

export async function getChannels(playlistId?: string): Promise<Channel[]> {
  const store = await readStore();
  const channels = playlistId
    ? store.channels.filter((c) => c.playlistId === playlistId)
    : store.channels;
  return channels.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getChannel(id: string): Promise<Channel | undefined> {
  const store = await readStore();
  return store.channels.find((c) => c.id === id);
}

export async function savePlaylistWithChannels(
  playlist: Omit<Playlist, "id" | "createdAt" | "updatedAt" | "channelCount">,
  parsedChannels: ParsedChannel[]
): Promise<{ playlist: Playlist; channels: Channel[] }> {
  const store = await readStore();
  const now = new Date().toISOString();
  const id = uuidv4();

  const newPlaylist: Playlist = {
    ...playlist,
    id,
    createdAt: now,
    updatedAt: now,
    channelCount: parsedChannels.length,
  };

  const newChannels: Channel[] = parsedChannels.map((ch) => ({
    id: uuidv4(),
    playlistId: id,
    name: ch.name,
    logo: ch.logo,
    group: ch.group,
    tvgId: ch.tvgId,
    tvgName: ch.tvgName,
    streams: ch.streams,
    createdAt: now,
  }));

  store.playlists.push(newPlaylist);
  store.channels.push(...newChannels);
  await writeStore(store);

  return { playlist: newPlaylist, channels: newChannels };
}

export async function refreshPlaylistChannels(
  playlistId: string,
  parsedChannels: ParsedChannel[]
): Promise<{ playlist: Playlist; channels: Channel[] }> {
  const store = await readStore();
  const playlist = store.playlists.find((p) => p.id === playlistId);
  if (!playlist) throw new Error("Playlist not found");

  store.channels = store.channels.filter((c) => c.playlistId !== playlistId);

  const now = new Date().toISOString();
  const newChannels: Channel[] = parsedChannels.map((ch) => ({
    id: uuidv4(),
    playlistId,
    name: ch.name,
    logo: ch.logo,
    group: ch.group,
    tvgId: ch.tvgId,
    tvgName: ch.tvgName,
    streams: ch.streams,
    createdAt: now,
  }));

  playlist.updatedAt = now;
  playlist.channelCount = parsedChannels.length;
  store.channels.push(...newChannels);
  await writeStore(store);

  return { playlist, channels: newChannels };
}

export async function deletePlaylist(id: string): Promise<boolean> {
  const store = await readStore();
  const before = store.playlists.length;
  store.playlists = store.playlists.filter((p) => p.id !== id);
  store.channels = store.channels.filter((c) => c.playlistId !== id);
  await writeStore(store);
  return store.playlists.length < before;
}
