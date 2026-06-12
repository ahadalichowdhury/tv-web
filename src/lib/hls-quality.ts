import type { Level } from "hls.js";

export interface QualityOption {
  index: number;
  label: string;
  height?: number;
  bitrate?: number;
}

export function formatLevelLabel(level: Level | QualityOption): string {
  if (level.height) return `${level.height}p`;
  const name = "name" in level ? (level as Level).name : undefined;
  if (name) return name;
  if (level.bitrate) return `${Math.round(level.bitrate / 1000)} kbps`;
  return "Unknown";
}

export function levelsFromHls(hlsLevels: Level[]): QualityOption[] {
  return hlsLevels.map((level, index) => ({
    index,
    label: formatLevelLabel(level),
    height: level.height,
    bitrate: level.bitrate,
  }));
}

export function sortLevelsByQuality(levels: QualityOption[]): QualityOption[] {
  return [...levels].sort((a, b) => (b.height ?? 0) - (a.height ?? 0));
}

export function getPlayingLabel(
  levels: QualityOption[],
  currentLevel: number,
  manualLevel: number
): string {
  if (levels.length === 0) return "Auto";

  const playing =
    currentLevel >= 0 && levels[currentLevel]
      ? levels[currentLevel].label
      : levels[0]?.label ?? "Auto";

  if (levels.length === 1) return playing;
  if (manualLevel === -1) return `Auto (${playing})`;
  return playing;
}
