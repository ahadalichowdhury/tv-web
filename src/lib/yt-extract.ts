import { spawn } from "child_process";

const URL_CACHE_TTL_MS = 10 * 60 * 1000;

type CacheEntry = { url: string; expiresAt: number };

declare global {
  // eslint-disable-next-line no-var
  var __ytStreamUrlCache: Map<string, CacheEntry> | undefined;
}

function getCache(): Map<string, CacheEntry> {
  if (!globalThis.__ytStreamUrlCache) {
    globalThis.__ytStreamUrlCache = new Map();
  }
  return globalThis.__ytStreamUrlCache;
}

function getYtDlpBinary(): string {
  return process.env.YT_DLP_PATH || "yt-dlp";
}

function getFormatSelector(): string {
  return process.env.YT_DLP_FORMAT || "best[ext=mp4]/best[height<=1080]/best";
}

export async function extractYoutubeStreamUrl(videoId: string): Promise<string> {
  const cached = getCache().get(videoId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  const pageUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const directUrl = await runYtDlp(pageUrl);

  getCache().set(videoId, {
    url: directUrl,
    expiresAt: Date.now() + URL_CACHE_TTL_MS,
  });

  return directUrl;
}

export function clearYoutubeStreamCache(videoId: string) {
  getCache().delete(videoId);
}

function runYtDlp(pageUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const binary = getYtDlpBinary();
    const args = [
      "-g",
      "--no-playlist",
      "--no-warnings",
      "-f",
      getFormatSelector(),
      pageUrl,
    ];

    const proc = spawn(binary, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    const timeout = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new Error("yt-dlp timed out"));
    }, 45_000);

    proc.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    proc.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    proc.on("error", (err) => {
      clearTimeout(timeout);
      reject(
        new Error(
          `yt-dlp not found or failed to start (${binary}). Install yt-dlp on the server. ${err.message}`
        )
      );
    });

    proc.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(stderr.trim() || `yt-dlp exited with code ${code}`));
        return;
      }

      const line = stdout
        .trim()
        .split("\n")
        .map((l) => l.trim())
        .find(Boolean);

      if (!line?.startsWith("http")) {
        reject(new Error("yt-dlp did not return a stream URL"));
        return;
      }

      resolve(line);
    });
  });
}
