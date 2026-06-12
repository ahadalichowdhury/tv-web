"use client";

import { getYoutubeEmbedUrl } from "@/lib/youtube";

interface YoutubePlayerProps {
  videoId: string;
  title: string;
  group: string;
}

export default function YoutubePlayer({ videoId, title, group }: YoutubePlayerProps) {
  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl">
        <div className="aspect-video w-full">
          <iframe
            key={videoId}
            src={getYoutubeEmbedUrl(videoId)}
            title={title}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
        <div className="pointer-events-none absolute left-0 right-0 top-0 bg-gradient-to-b from-black/80 to-transparent p-4">
          <h2 className="truncate text-lg font-semibold text-white">{title}</h2>
          <p className="truncate text-xs text-zinc-300">{group}</p>
        </div>
      </div>
    </div>
  );
}
