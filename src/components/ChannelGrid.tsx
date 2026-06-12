"use client";

import type { Channel } from "@/lib/types";

interface ChannelGridProps {
  channels: Channel[];
  selectedId?: string;
  onSelect: (channel: Channel) => void;
}

export default function ChannelGrid({
  channels,
  selectedId,
  onSelect,
}: ChannelGridProps) {
  if (channels.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 py-16 text-zinc-400">
        <div className="mb-3 text-4xl">📡</div>
        <p className="font-medium">No channels found</p>
        <p className="mt-1 text-sm">Add a playlist from the admin panel</p>
      </div>
    );
  }

  const grouped = channels.reduce<Record<string, Channel[]>>((acc, ch) => {
    const key = ch.group || "Uncategorized";
    if (!acc[key]) acc[key] = [];
    acc[key].push(ch);
    return acc;
  }, {});

  const sortedGroups = Object.keys(grouped).sort();

  return (
    <div className="space-y-8">
      {sortedGroups.map((group) => (
        <section key={group}>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-emerald-400">
            <span className="h-px flex-1 bg-emerald-400/20" />
            {group}
            <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-zinc-400">
              {grouped[group].length}
            </span>
            <span className="h-px flex-1 bg-emerald-400/20" />
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {grouped[group].map((channel) => {
              const selected = channel.id === selectedId;
              return (
                <button
                  key={channel.id}
                  type="button"
                  onClick={() => onSelect(channel)}
                  className={`group flex flex-col overflow-hidden rounded-xl border text-left transition-all ${
                    selected
                      ? "border-emerald-400 bg-emerald-400/10 ring-1 ring-emerald-400/50"
                      : "border-white/10 bg-white/5 hover:border-emerald-400/40 hover:bg-white/10"
                  }`}
                >
                  <div className="relative aspect-video w-full overflow-hidden bg-zinc-900">
                    {channel.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={channel.logo}
                        alt=""
                        className="h-full w-full object-contain p-2"
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-2xl text-zinc-600">
                        📺
                      </div>
                    )}
                    {selected && (
                      <div className="absolute inset-0 flex items-center justify-center bg-emerald-400/20">
                        <span className="rounded-full bg-emerald-400 px-2 py-1 text-xs font-bold text-black">
                          LIVE
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="line-clamp-2 text-xs font-medium leading-snug text-zinc-100">
                      {channel.name}
                    </p>
                    {channel.streams.length > 1 && (
                      <p className="mt-1 text-[10px] text-zinc-500">
                        {channel.streams.length} sources
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
