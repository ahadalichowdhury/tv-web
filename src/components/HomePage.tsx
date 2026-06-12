"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ChannelGrid from "@/components/ChannelGrid";
import DisableInspect from "@/components/DisableInspect";
import LiveVisitorBadge, { useLiveVisitors } from "@/components/LiveVisitorBadge";
import VideoPlayer from "@/components/VideoPlayer";
import type { Channel } from "@/lib/types";

export default function HomePage() {
  const headerRef = useRef<HTMLElement>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const liveCount = useLiveVisitors();

  const [channels, setChannels] = useState<Channel[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [selected, setSelected] = useState<Channel | null>(null);
  const [streamIndex, setStreamIndex] = useState(0);
  const [activeGroup, setActiveGroup] = useState<string>("All");
  const [loading, setLoading] = useState(true);
  const initialLoadDone = useRef(false);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    const update = () => setHeaderHeight(header.offsetHeight);
    update();

    const observer = new ResizeObserver(update);
    observer.observe(header);
    window.addEventListener("resize", update);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [groups.length]);

  const loadChannels = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeGroup !== "All") params.set("group", activeGroup);
      const res = await fetch(`/api/channels?${params}`, { cache: "no-store" });
      const data = await res.json();
      setChannels(data.channels);
      setGroups(data.groups);
      setSelected((prev) => {
        if (!prev) return null;
        const updated = data.channels.find((c: Channel) => c.id === prev.id);
        if (!updated) return null;
        // Keep the same object reference when metadata unchanged so the player
        // does not tear down and restart the stream on background refresh.
        if (
          prev.name === updated.name &&
          prev.group === updated.group &&
          prev.logo === updated.logo &&
          JSON.stringify(prev.streams) === JSON.stringify(updated.streams)
        ) {
          return prev;
        }
        return updated;
      });
    } finally {
      if (!silent) setLoading(false);
      initialLoadDone.current = true;
    }
  }, [activeGroup]);

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  useEffect(() => {
    const poll = () => {
      if (initialLoadDone.current) loadChannels({ silent: true });
    };
    const interval = setInterval(poll, 15_000);
    const onVisible = () => {
      if (!document.hidden) poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loadChannels]);

  const handleSelect = (channel: Channel) => {
    setSelected(channel);
    setStreamIndex(0);
  };

  const filteredCount = useMemo(() => channels.length, [channels]);

  return (
    <div className="min-h-screen bg-[#0b0f14] text-zinc-100 select-none">
      <DisableInspect />
      <header
        ref={headerRef}
        className="sticky top-0 z-30 border-b border-white/10 bg-[#0b0f14]/95 backdrop-blur-md"
      >
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-lg font-bold text-black">
              TV
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Live TV</h1>
              <p className="text-xs text-zinc-400">{filteredCount} channels</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
            <LiveVisitorBadge count={liveCount} />
          </div>
        </div>
        {groups.length > 0 && (
          <div className="mx-auto max-w-[1600px] overflow-x-auto px-4 pb-3">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setActiveGroup("All")}
                className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${
                  activeGroup === "All"
                    ? "bg-emerald-500 text-black"
                    : "bg-white/5 text-zinc-300 hover:bg-white/10"
                }`}
              >
                All
              </button>
              {groups.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setActiveGroup(g)}
                  className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${
                    activeGroup === g
                      ? "bg-emerald-500 text-black"
                      : "bg-white/5 text-zinc-300 hover:bg-white/10"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-4 lg:grid lg:grid-cols-[1fr_380px] lg:gap-6 lg:py-6">
        {/* Player: top + sticky on mobile, sidebar on desktop — single instance */}
        <aside
          className="sticky z-20 order-1 -mx-4 border-b border-white/10 bg-[#0b0f14]/95 px-4 pb-3 backdrop-blur-md max-lg:top-[var(--header-h)] lg:top-28 lg:order-2 lg:mx-0 lg:self-start lg:border-0 lg:bg-transparent lg:px-0 lg:pb-0 lg:backdrop-blur-none"
          style={{ "--header-h": `${headerHeight}px` } as React.CSSProperties}
        >
          <VideoPlayer channel={selected} streamIndex={streamIndex} />
          {selected && selected.streams.length > 1 && (
            <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3 lg:mt-4 lg:p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Stream Sources
              </p>
              <div className="flex flex-wrap gap-2">
                {selected.streams.map((stream, idx) => (
                  <button
                    key={`${selected.id}-${idx}`}
                    type="button"
                    onClick={() => setStreamIndex(idx)}
                    className={`rounded-lg px-3 py-1.5 text-xs ${
                      streamIndex === idx
                        ? "bg-emerald-500 text-black"
                        : "bg-white/10 text-zinc-300 hover:bg-white/20"
                    }`}
                  >
                    Source {idx + 1}
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>

        <section className="order-2 min-w-0 pt-4 lg:order-1 lg:pt-0">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-zinc-400">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
            </div>
          ) : (
            <ChannelGrid
              channels={channels}
              selectedId={selected?.id}
              onSelect={handleSelect}
            />
          )}
        </section>
      </main>
    </div>
  );
}
