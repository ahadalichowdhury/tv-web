"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { isDashUrl, isHlsUrl } from "@/lib/m3u-parser";
import {
  getPlayingLabel,
  levelsFromHls,
  type QualityOption,
} from "@/lib/hls-quality";
import type { StreamKind } from "@/lib/stream-detect";
import { resolvePlaybackUrl } from "@/lib/stream-playback";
import { extractYoutubeVideoId, isYoutubeStream } from "@/lib/youtube";
import QualitySelector from "@/components/QualitySelector";
import YoutubePlayer from "@/components/YoutubePlayer";
import DashPlayer from "@/components/DashPlayer";
import type { Channel } from "@/lib/types";

interface VideoPlayerProps {
  channel: Channel | null;
  streamIndex?: number;
}

function stopPlayback(video: HTMLVideoElement, hls: Hls | null) {
  video.pause();
  if (hls) hls.stopLoad();
}

function useHlsPlayback(
  playUrl: string | undefined,
  proxyFallbackUrl: string | undefined,
  streamKind: StreamKind,
  originalUrl: string | undefined,
  enabled: boolean
) {
  const [activeUrl, setActiveUrl] = useState(playUrl);
  const usedFallbackRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const userPausedRef = useRef(false);
  const manualLevelRef = useRef(-1);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [qualityLevels, setQualityLevels] = useState<QualityOption[]>([]);
  const [manualLevel, setManualLevel] = useState(-1);
  const [currentLabel, setCurrentLabel] = useState("Auto");

  const syncQualityLabel = useCallback((hls: Hls | null, video?: HTMLVideoElement) => {
    if (hls && hls.levels.length > 0) {
      setCurrentLabel(
        getPlayingLabel(
          levelsFromHls(hls.levels),
          hls.currentLevel,
          manualLevelRef.current
        )
      );
      return;
    }
    if (video?.videoHeight) {
      setCurrentLabel(`${video.videoHeight}p`);
    }
  }, []);

  const handleQualityChange = useCallback((level: number) => {
    manualLevelRef.current = level;
    setManualLevel(level);
    if (hlsRef.current) {
      hlsRef.current.currentLevel = level;
      syncQualityLabel(hlsRef.current, videoRef.current ?? undefined);
    }
  }, [syncQualityLabel]);

  useEffect(() => {
    usedFallbackRef.current = false;
    setActiveUrl(playUrl);
  }, [playUrl]);

  useEffect(() => {
    userPausedRef.current = false;
    manualLevelRef.current = -1;
    setManualLevel(-1);
    setQualityLevels([]);
    setCurrentLabel("Auto");
  }, [activeUrl]);

  useEffect(() => {
    if (!enabled || !activeUrl) {
      setError(null);
      setLoading(false);
      return;
    }

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

    let hls: Hls | null = null;
    const useHls =
      streamKind === "hls" ||
      isHlsUrl(originalUrl ?? "") ||
      activeUrl.startsWith("/api/stream") ||
      isHlsUrl(activeUrl);

    const onPause = () => {
      userPausedRef.current = true;
      if (hlsRef.current) hlsRef.current.stopLoad();
    };

    const onPlay = () => {
      userPausedRef.current = false;
      if (hlsRef.current) hlsRef.current.startLoad();
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        video.pause();
        if (hlsRef.current) hlsRef.current.stopLoad();
      } else if (!userPausedRef.current) {
        if (hlsRef.current) hlsRef.current.startLoad();
        video.play().catch(() => undefined);
      }
    };

    const onVideoResize = () => syncQualityLabel(hlsRef.current, video);

    video.addEventListener("pause", onPause);
    video.addEventListener("play", onPlay);
    video.addEventListener("resize", onVideoResize);
    document.addEventListener("visibilitychange", onVisibilityChange);

    const tryAutoplay = () => {
      if (!userPausedRef.current && !document.hidden) {
        video.play().catch(() => undefined);
      }
    };

    if (useHls && Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
        maxBufferLength: 60,
        maxMaxBufferLength: 120,
        capLevelToPlayerSize: true,
      });
      hlsRef.current = hls;

      hls.loadSource(activeUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        const levels = levelsFromHls(hls!.levels);
        setQualityLevels(levels);
        if (manualLevelRef.current >= 0 && manualLevelRef.current < levels.length) {
          hls!.currentLevel = manualLevelRef.current;
        }
        setLoading(false);
        syncQualityLabel(hls, video);
        tryAutoplay();
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, () => syncQualityLabel(hls, video));
      hls.on(Hls.Events.LEVELS_UPDATED, () => {
        setQualityLevels(levelsFromHls(hls!.levels));
        syncQualityLabel(hls, video);
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;
        if (userPausedRef.current || video.paused) {
          setLoading(false);
          return;
        }
        setLoading(false);
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          const response = data.networkDetails as Response | undefined;
          const status = response?.status ?? 0;

          // Direct CDN failed (CORS, geo-block, etc.) — fall back to server proxy once.
          if (
            proxyFallbackUrl &&
            activeUrl !== proxyFallbackUrl &&
            !usedFallbackRef.current
          ) {
            usedFallbackRef.current = true;
            setActiveUrl(proxyFallbackUrl);
            return;
          }

          if (status >= 400) {
            setError(
              status === 502
                ? "Stream blocked or returned a web page — may be IP-restricted or expired"
                : "Stream unavailable — server returned an error"
            );
            return;
          }
          setError("Network error — retrying...");
          hls?.startLoad();
          return;
        }
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          setError("Media error — recovering...");
          hls?.recoverMediaError();
          return;
        }
        setError("Playback failed — stream may be offline or blocked");
      });
    } else if (useHls && video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = activeUrl;
      video.addEventListener(
        "loadedmetadata",
        () => {
          setLoading(false);
          syncQualityLabel(null, video);
          tryAutoplay();
        },
        { once: true }
      );
      video.addEventListener("error", () => setError("Unable to play this stream"), {
        once: true,
      });
    } else if (streamKind === "progressive" || !useHls) {
      video.src = activeUrl;
      video.addEventListener(
        "loadedmetadata",
        () => {
          setLoading(false);
          syncQualityLabel(null, video);
          tryAutoplay();
        },
        { once: true }
      );
      video.addEventListener("error", () => setError("Unable to play this stream"), {
        once: true,
      });
    } else {
      setLoading(false);
      setError("HLS playback is not supported in this browser");
    }

    return () => {
      video.removeEventListener("pause", onPause);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("resize", onVideoResize);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      stopPlayback(video, hlsRef.current);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [activeUrl, proxyFallbackUrl, streamKind, originalUrl, enabled, syncQualityLabel]);

  return {
    videoRef,
    error,
    loading,
    qualityLevels,
    manualLevel,
    currentLabel,
    handleQualityChange,
  };
}

export default function VideoPlayer({ channel, streamIndex = 0 }: VideoPlayerProps) {
  const stream = channel?.streams[streamIndex] ?? channel?.streams[0];
  const streamUrl = stream?.url;
  const isYoutube = isYoutubeStream(stream);
  const youtubeVideoId =
    isYoutube && streamUrl ? extractYoutubeVideoId(streamUrl) : null;

  // Detect stream type: honour the parsed .type from the M3U, then fall back
  // to URL-based detection. Pipe-format URLs (url|header=val) are handled by
  // the parser, so streamUrl here is already the clean URL.
  const cleanUrl = streamUrl?.split("|")[0] ?? "";
  const isDash =
    stream?.type === "dash" || (!stream?.type && isDashUrl(cleanUrl));

  const playbackUrls = channel ? resolvePlaybackUrl(channel, streamIndex) : null;
  const streamKind: StreamKind = isDash ? "dash" : "hls";

  const playback = useHlsPlayback(
    playbackUrls?.playUrl,
    playbackUrls?.proxyUrl,
    streamKind,
    cleanUrl,
    Boolean(playbackUrls?.playUrl) && !isYoutube && !isDash
  );

  if (!channel) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-2xl border border-white/10 bg-black/40">
        <div className="text-center text-zinc-400">
          <div className="mb-2 text-4xl">📺</div>
          <p className="text-sm">Select a channel to start watching</p>
        </div>
      </div>
    );
  }

  if (isYoutube) {
    if (!youtubeVideoId) {
      return (
        <div className="flex aspect-video w-full items-center justify-center rounded-2xl border border-white/10 bg-black/40">
          <p className="text-sm text-red-400">Invalid YouTube link for this channel</p>
        </div>
      );
    }
    return (
      <YoutubePlayer
        videoId={youtubeVideoId}
        title={channel.name}
        group={channel.group}
      />
    );
  }

  if (isDash && channel) {
    return <DashPlayer channel={channel} streamIndex={streamIndex} />;
  }

  const { videoRef, error, loading, qualityLevels, manualLevel, currentLabel, handleQualityChange } =
    playback;

  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl">
        <video
          ref={videoRef}
          className="aspect-video w-full bg-black"
          controls
          playsInline
        />
        {(loading || error) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 px-6 text-center">
            {loading ? (
              <div className="flex flex-col items-center gap-3">
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
                <p className="text-sm text-zinc-300">Loading {channel.name}...</p>
              </div>
            ) : (
              <div>
                <p className="mb-1 font-medium text-red-300">Unable to play</p>
                <p className="text-sm text-zinc-400">{error}</p>
              </div>
            )}
          </div>
        )}
        <div className="pointer-events-none absolute left-0 right-0 top-0 bg-gradient-to-b from-black/80 to-transparent p-4">
          <h2 className="truncate text-lg font-semibold text-white">{channel.name}</h2>
          <p className="truncate text-xs text-zinc-300">{channel.group}</p>
        </div>
      </div>

      {!loading && !error && qualityLevels.length > 0 && (
        <QualitySelector
          levels={qualityLevels}
          manualLevel={manualLevel}
          currentLabel={currentLabel}
          onChange={handleQualityChange}
          disabled={loading}
        />
      )}

      {!loading && !error && qualityLevels.length === 0 && currentLabel !== "Auto" && (
        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs">
          <span className="text-zinc-400">Quality</span>
          <span className="font-medium text-emerald-300">{currentLabel}</span>
        </div>
      )}
    </div>
  );
}
