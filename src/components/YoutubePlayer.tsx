"use client";

import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { getYoutubeEmbedUrl, getYoutubeProxyStreamUrl } from "@/lib/youtube";

interface YoutubePlayerProps {
  videoId: string;
  title: string;
  group: string;
}

const USE_EMBED = process.env.NEXT_PUBLIC_YT_USE_EMBED === "true";

export default function YoutubePlayer({ videoId, title, group }: YoutubePlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [loading, setLoading] = useState(!USE_EMBED);
  const [error, setError] = useState<string | null>(null);
  const [useEmbedFallback, setUseEmbedFallback] = useState(USE_EMBED);

  const proxySrc = getYoutubeProxyStreamUrl(videoId);

  useEffect(() => {
    if (useEmbedFallback) return;

    const video = videoRef.current;
    if (!video) return;

    setLoading(true);
    setError(null);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    video.pause();
    video.removeAttribute("src");
    video.load();

    let cancelled = false;

    const start = async () => {
      try {
        const metaRes = await fetch(
          `/api/yt-stream/meta?id=${encodeURIComponent(videoId)}`,
          { cache: "no-store" }
        );
        const meta = await metaRes.json();
        if (!metaRes.ok) {
          throw new Error(meta.error || "Failed to load stream info");
        }
        const isHls = Boolean(meta.isHls);

        if (cancelled) return;

        if (isHls && Hls.isSupported()) {
          const hls = new Hls({ enableWorker: true });
          hlsRef.current = hls;
          hls.loadSource(proxySrc);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (!cancelled) {
              setLoading(false);
              video.play().catch(() => undefined);
            }
          });
          hls.on(Hls.Events.ERROR, (_e, data) => {
            if (data.fatal && !cancelled) {
              setLoading(false);
              setError("HLS playback failed. Trying YouTube embed…");
              setUseEmbedFallback(true);
            }
          });
          return;
        }

        if (isHls && video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = proxySrc;
          video.addEventListener(
            "loadeddata",
            () => {
              if (!cancelled) {
                setLoading(false);
                video.play().catch(() => undefined);
              }
            },
            { once: true }
          );
          return;
        }

        video.src = proxySrc;
        video.addEventListener(
          "loadeddata",
          () => {
            if (!cancelled) setLoading(false);
          },
          { once: true }
        );
        video.addEventListener(
          "error",
          () => {
            if (!cancelled) {
              setLoading(false);
              setError("Could not play via server proxy. Trying YouTube embed…");
              setUseEmbedFallback(true);
            }
          },
          { once: true }
        );
        video.play().catch(() => undefined);
      } catch (err) {
        if (!cancelled) {
          setLoading(false);
          setError(
            err instanceof Error ? err.message : "Stream failed. Trying YouTube embed…"
          );
          setUseEmbedFallback(true);
        }
      }
    };

    start();

    return () => {
      cancelled = true;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      video.pause();
      video.removeAttribute("src");
    };
  }, [videoId, proxySrc, useEmbedFallback]);

  if (useEmbedFallback) {
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

  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl">
        <video
          ref={videoRef}
          className="aspect-video w-full bg-black"
          controls
          playsInline
        />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
            <div className="flex flex-col items-center gap-3">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
              <p className="text-sm text-zinc-300">Loading YouTube stream…</p>
            </div>
          </div>
        )}
        {error && !loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 px-4 text-center">
            <p className="text-sm text-zinc-400">{error}</p>
          </div>
        )}
        <div className="pointer-events-none absolute left-0 right-0 top-0 bg-gradient-to-b from-black/80 to-transparent p-4">
          <h2 className="truncate text-lg font-semibold text-white">{title}</h2>
          <p className="truncate text-xs text-zinc-300">{group}</p>
        </div>
      </div>
    </div>
  );
}
