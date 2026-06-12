"use client";

import { useState } from "react";
import type { StreamKind } from "@/lib/stream-detect";

export interface NetworkStreamSession {
  playUrl: string;
  kind: StreamKind;
  title: string;
}

interface NetworkStreamBoxProps {
  onPlay: (session: NetworkStreamSession) => void;
}

export default function NetworkStreamBox({ onPlay }: NetworkStreamBoxProps) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [referer, setReferer] = useState("");
  const [userAgent, setUserAgent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/stream/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          referer: referer || undefined,
          userAgent: userAgent || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to open stream");

      onPlay({
        playUrl: data.playUrl,
        kind: data.kind as StreamKind,
        title: "Network Stream",
      });
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open stream");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-white/5 lg:mt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left text-xs font-medium text-zinc-300 hover:bg-white/5 lg:px-4"
      >
        <span className="flex items-center gap-2">
          <span className="text-emerald-400">▶</span>
          Open Network Stream
        </span>
        <span className="text-zinc-500">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <form onSubmit={submit} className="space-y-3 border-t border-white/10 p-3 lg:p-4">
          <p className="text-[11px] leading-relaxed text-zinc-500">
            Paste any network URL (M3U8, MP4, etc.). Optional Referer and User-Agent for
            protected streams — like VLC network stream.
          </p>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/stream.m3u8"
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs outline-none focus:border-emerald-400"
            required
          />
          <input
            type="url"
            value={referer}
            onChange={(e) => setReferer(e.target.value)}
            placeholder="Referer (optional) e.g. https://executeandship.com/"
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs outline-none focus:border-emerald-400"
          />
          <input
            type="text"
            value={userAgent}
            onChange={(e) => setUserAgent(e.target.value)}
            placeholder="User-Agent (optional)"
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs outline-none focus:border-emerald-400"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="w-full rounded-lg bg-emerald-500 py-2 text-xs font-semibold text-black hover:bg-emerald-400 disabled:opacity-50"
          >
            {loading ? "Opening…" : "Play Stream"}
          </button>
        </form>
      )}
    </div>
  );
}
