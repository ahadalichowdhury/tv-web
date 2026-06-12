import type { ParsedChannel } from "./types";

type JsonChannel = {
  name?: string;
  title?: string;
  link?: string;
  url?: string;
  stream_url?: string;
  logo?: string;
  icon?: string;
  category_name?: string;
  group?: string;
  group_title?: string;
  tvg_id?: string;
  tvgId?: string;
  cookie?: string;
};

function pickString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  return undefined;
}

function normalizeEntry(entry: JsonChannel): ParsedChannel | null {
  const name = pickString(entry.name) ?? pickString(entry.title);
  const url =
    pickString(entry.link) ??
    pickString(entry.url) ??
    pickString(entry.stream_url);

  if (!name || !url || !/^https?:\/\//i.test(url)) return null;

  const group =
    pickString(entry.category_name) ??
    pickString(entry.group) ??
    pickString(entry.group_title) ??
    "Uncategorized";

  const logo = pickString(entry.logo) ?? pickString(entry.icon);
  const tvgId = pickString(entry.tvg_id) ?? pickString(entry.tvgId);

  return {
    name,
    logo,
    group,
    tvgId,
    streams: [{ url }],
  };
}

function extractEntries(data: unknown): JsonChannel[] {
  if (Array.isArray(data)) {
    return data as JsonChannel[];
  }

  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    for (const key of ["channels", "items", "data", "playlist"]) {
      if (Array.isArray(record[key])) {
        return record[key] as JsonChannel[];
      }
    }
  }

  return [];
}

export function parseJsonPlaylist(content: string): ParsedChannel[] {
  const trimmed = content.trim();
  if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) {
    return [];
  }

  try {
    const data = JSON.parse(trimmed) as unknown;
    const entries = extractEntries(data);
    return entries
      .map((entry) => normalizeEntry(entry))
      .filter((ch): ch is ParsedChannel => ch !== null);
  } catch {
    return [];
  }
}
