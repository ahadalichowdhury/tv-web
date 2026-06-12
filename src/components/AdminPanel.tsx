"use client";

import { useState } from "react";
import type { Playlist } from "@/lib/types";

function parseYoutubeBulk(text: string): { name: string; url: string }[] {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const entries: { name: string; url: string }[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (/^https?:\/\//i.test(lines[i])) {
      entries.push({ name: `YouTube ${entries.length + 1}`, url: lines[i] });
      continue;
    }
    if (i + 1 < lines.length && /^https?:\/\//i.test(lines[i + 1])) {
      entries.push({ name: lines[i], url: lines[i + 1] });
      i++;
    }
  }

  return entries;
}

interface AdminPanelProps {
  playlists: Playlist[];
  onUpdate: () => void;
}

export default function AdminPanel({ playlists, onUpdate }: AdminPanelProps) {
  const [name, setName] = useState("");
  const [sourceType, setSourceType] = useState<"url" | "file" | "stream" | "youtube">("url");
  const [sourceUrl, setSourceUrl] = useState("");
  const [streamUrl, setStreamUrl] = useState("");
  const [userAgent, setUserAgent] = useState("");
  const [referer, setReferer] = useState("");
  const [channelName, setChannelName] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeBulk, setYoutubeBulk] = useState("");
  const [group, setGroup] = useState("YouTube");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          sourceType,
          sourceUrl,
          content,
          streamUrl,
          userAgent: userAgent || undefined,
          referer: referer || undefined,
          channelName,
          youtubeUrl,
          group,
          youtubeEntries: (() => {
            const entries = parseYoutubeBulk(youtubeBulk);
            return entries.length > 0 ? entries : undefined;
          })(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add playlist");

      setMessage({
        type: "ok",
        text: `Added "${data.playlist.name}" with ${data.channels.length} channels`,
      });
      setName("");
      setSourceUrl("");
      setContent("");
      setStreamUrl("");
      setChannelName("");
      setYoutubeUrl("");
      setYoutubeBulk("");
      onUpdate();
    } catch (err) {
      setMessage({
        type: "err",
        text: err instanceof Error ? err.message : "Something went wrong",
      });
    } finally {
      setLoading(false);
    }
  };

  const refresh = async (id: string) => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/playlists/${id}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Refresh failed");
      setMessage({
        type: "ok",
        text: `Refreshed playlist — ${data.channels.length} channels`,
      });
      onUpdate();
    } catch (err) {
      setMessage({
        type: "err",
        text: err instanceof Error ? err.message : "Refresh failed",
      });
    } finally {
      setLoading(false);
    }
  };

  const remove = async (id: string, playlistName: string) => {
    if (!confirm(`Delete playlist "${playlistName}" and all its channels?`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/playlists/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setMessage({ type: "ok", text: `Deleted "${playlistName}"` });
      onUpdate();
    } catch (err) {
      setMessage({
        type: "err",
        text: err instanceof Error ? err.message : "Delete failed",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setContent(String(reader.result || ""));
      if (!name) setName(file.name.replace(/\.m3u8?$/i, ""));
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-8">
      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-lg font-semibold">Add Playlist</h2>

        <div>
          <label className="mb-1 block text-sm text-zinc-400">Playlist Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Sports Channels"
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-emerald-400"
            required
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {(
            [
              ["url", "From URL"],
              ["file", "Upload M3U"],
              ["stream", "Single M3U8"],
              ["youtube", "YouTube"],
            ] as const
          ).map(([type, label]) => (
            <button
              key={type}
              type="button"
              onClick={() => setSourceType(type)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                sourceType === type
                  ? "bg-emerald-500 text-black"
                  : "bg-white/5 text-zinc-300 hover:bg-white/10"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {sourceType === "url" ? (
          <div>
            <label className="mb-1 block text-sm text-zinc-400">M3U URL</label>
            <input
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://pastebin.com/raw/xxxxx"
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-emerald-400"
            />
          </div>
        ) : sourceType === "youtube" ? (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm text-zinc-400">Group name</label>
              <input
                value={group}
                onChange={(e) => setGroup(e.target.value)}
                placeholder="YouTube"
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-emerald-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-zinc-400">Channel name</label>
              <input
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                placeholder="FIFA Live Stream"
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-emerald-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-zinc-400">YouTube URL</label>
              <input
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=xxxxx"
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-emerald-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-zinc-400">
                Or add multiple (name + URL per line pair)
              </label>
              <textarea
                value={youtubeBulk}
                onChange={(e) => setYoutubeBulk(e.target.value)}
                rows={6}
                placeholder={"FIFA Live\nhttps://youtube.com/watch?v=xxx\n\nSports Channel\nhttps://youtu.be/yyy"}
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-xs outline-none focus:border-emerald-400"
              />
            </div>
          </div>
        ) : sourceType === "stream" ? (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm text-zinc-400">M3U8 Stream URL</label>
              <input
                value={streamUrl}
                onChange={(e) => setStreamUrl(e.target.value)}
                placeholder="https://example.com/live/stream.m3u8"
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-emerald-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-zinc-400">
                User-Agent (optional)
              </label>
              <input
                value={userAgent}
                onChange={(e) => setUserAgent(e.target.value)}
                placeholder="ExoPlayerDemo/2.15.1 ..."
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-emerald-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-zinc-400">Referer (optional)</label>
              <input
                value={referer}
                onChange={(e) => setReferer(e.target.value)}
                placeholder="https://example.com/"
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-emerald-400"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm text-zinc-400">Upload .m3u / .m3u8 file</label>
              <input
                type="file"
                accept=".m3u,.m3u8,text/plain"
                onChange={handleFileUpload}
                className="w-full text-sm text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-500 file:px-3 file:py-2 file:text-sm file:font-medium file:text-black"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-zinc-400">Or paste M3U content</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={8}
                placeholder="#EXTM3U&#10;#EXTINF:-1,Channel Name&#10;https://..."
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-xs outline-none focus:border-emerald-400"
              />
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:opacity-50"
        >
          {loading
            ? "Processing..."
            : sourceType === "stream"
              ? "Add Stream"
              : sourceType === "youtube"
                ? "Add YouTube"
                : "Add Playlist"}
        </button>

        {message && (
          <p
            className={`text-sm ${message.type === "ok" ? "text-emerald-400" : "text-red-400"}`}
          >
            {message.text}
          </p>
        )}
      </form>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="mb-4 text-lg font-semibold">Manage Playlists</h2>
        {playlists.length === 0 ? (
          <p className="text-sm text-zinc-400">No playlists yet.</p>
        ) : (
          <ul className="space-y-3">
            {playlists.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/30 px-4 py-3"
              >
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-zinc-400">
                    {p.channelCount} channels · {p.sourceType === "url" ? "URL" : "File"} ·{" "}
                    {new Date(p.updatedAt).toLocaleString()}
                  </p>
                  {p.sourceUrl && (
                    <p className="mt-1 truncate text-xs text-zinc-500">{p.sourceUrl}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  {p.sourceType === "url" && (
                    <button
                      type="button"
                      onClick={() => refresh(p.id)}
                      disabled={loading}
                      className="rounded-lg bg-white/10 px-3 py-1.5 text-xs hover:bg-white/20"
                    >
                      Refresh
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => remove(p.id, p.name)}
                    disabled={loading}
                    className="rounded-lg bg-red-500/20 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/30"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
