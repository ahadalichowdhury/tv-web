"use client";

import { useEffect, useRef, useState } from "react";
import type { Channel } from "@/lib/types";
import { resolvePlaybackUrl } from "@/lib/stream-playback";

interface DashPlayerProps {
  channel: Channel;
  streamIndex?: number;
}

/**
 * Parses a ClearKey inline value into the JSON format that dash.js expects.
 *
 * Supported input formats:
 *  - "keyId:key"  (both as hex strings, colon-separated)
 *  - A JSON string already in the {"keys":[...],"type":"temporary"} format
 */
function buildClearKeyConfig(clearKey: string): object | null {
  if (!clearKey) return null;

  // Already a JSON object
  if (clearKey.trim().startsWith("{")) {
    try {
      return JSON.parse(clearKey);
    } catch {
      return null;
    }
  }

  // Inline "keyId:key" hex format
  const colonIdx = clearKey.indexOf(":");
  if (colonIdx === -1) return null;

  const keyId = clearKey.slice(0, colonIdx).trim().toLowerCase();
  const key = clearKey.slice(colonIdx + 1).trim().toLowerCase();

  // dash.js ClearKey format
  return {
    clearkey: {
      [keyId]: key,
    },
  };
}

export default function DashPlayer({ channel, streamIndex = 0 }: DashPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<ReturnType<typeof import("dashjs")["MediaPlayer"]> | null>(null);
  const usedFallbackRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const { playUrl, proxyUrl } = resolvePlaybackUrl(channel, streamIndex);
  const [activeUrl, setActiveUrl] = useState(playUrl);
  const stream = channel.streams[streamIndex] ?? channel.streams[0];

  useEffect(() => {
    usedFallbackRef.current = false;
    setActiveUrl(playUrl);
  }, [playUrl]);

  useEffect(() => {
    if (!videoRef.current) return;

    let destroyed = false;

    const init = async () => {
      const dashjs = await import("dashjs");

      if (destroyed) return;

      const player = dashjs.MediaPlayer().create();
      playerRef.current = player as unknown as ReturnType<typeof import("dashjs")["MediaPlayer"]>;

      // Basic settings
      player.updateSettings({
        streaming: {
          abr: { autoSwitchBitrate: { video: true, audio: true } },
        },
      });

      // ClearKey DRM
      if (stream?.clearKey) {
        const ckConfig = buildClearKeyConfig(stream.clearKey);
        if (ckConfig) {
          player.updateSettings({
            streaming: {
              protection: {
                // @ts-expect-error dashjs typing is loose
                drm: ckConfig,
              },
            },
          });
        }
      } else if (stream?.clearKeyUrl) {
        player.updateSettings({
          streaming: {
            protection: {
              // @ts-expect-error dashjs typing is loose
              drm: {
                "org.w3.clearkey": {
                  serverURL: stream.clearKeyUrl,
                },
              },
            },
          },
        });
      } else if (stream?.widevineUrl) {
        player.updateSettings({
          streaming: {
            protection: {
              // @ts-expect-error dashjs typing is loose
              drm: {
                "com.widevine.alpha": {
                  serverURL: stream.widevineUrl,
                },
              },
            },
          },
        });
      } else if (stream?.playreadyUrl) {
        player.updateSettings({
          streaming: {
            protection: {
              // @ts-expect-error dashjs typing is loose
              drm: {
                "com.microsoft.playready": {
                  serverURL: stream.playreadyUrl,
                },
              },
            },
          },
        });
      }

      player.initialize(videoRef.current!, activeUrl, true);

      player.on(dashjs.MediaPlayer.events.PLAYBACK_PLAYING, () => {
        if (!destroyed) setLoading(false);
      });

      player.on(dashjs.MediaPlayer.events.PLAYBACK_WAITING, () => {
        if (!destroyed) setLoading(true);
      });

      player.on(dashjs.MediaPlayer.events.PLAYBACK_STALLED, () => {
        if (!destroyed) setLoading(true);
      });

      player.on(dashjs.MediaPlayer.events.PLAYBACK_NOT_ALLOWED, () => {
        if (!destroyed) setLoading(false);
      });

      player.on(dashjs.MediaPlayer.events.PLAYBACK_STARTED, () => {
        if (!destroyed) setLoading(false);
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      player.on(dashjs.MediaPlayer.events.ERROR, (e: any) => {
        if (destroyed) return;

        if (activeUrl !== proxyUrl && !usedFallbackRef.current) {
          usedFallbackRef.current = true;
          setActiveUrl(proxyUrl);
          return;
        }

        setLoading(false);
        const msg =
          (e?.error?.message as string | undefined) ??
          (typeof e?.error === "string" ? e.error : null) ??
          "DASH playback error";
        setError(msg);
      });
    };

    init().catch(() => {
      if (!destroyed) {
        setLoading(false);
        setError("Failed to initialise DASH player");
      }
    });

    return () => {
      destroyed = true;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (playerRef.current as any)?.reset?.();
      } catch {
        // ignore
      }
      playerRef.current = null;
    };
  }, [
    activeUrl,
    proxyUrl,
    stream?.clearKey,
    stream?.clearKeyUrl,
    stream?.widevineUrl,
    stream?.playreadyUrl,
  ]);

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
            {loading && !error ? (
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
        <div className="pointer-events-none absolute left-0 right-0 top-0 bg-linear-to-b from-black/80 to-transparent p-4">
          <h2 className="truncate text-lg font-semibold text-white">{channel.name}</h2>
          <p className="truncate text-xs text-zinc-300">{channel.group}</p>
        </div>
      </div>
    </div>
  );
}
