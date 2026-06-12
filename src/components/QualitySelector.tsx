"use client";

import { useEffect, useRef, useState } from "react";
import type { QualityOption } from "@/lib/hls-quality";
import { sortLevelsByQuality } from "@/lib/hls-quality";

interface QualitySelectorProps {
  levels: QualityOption[];
  manualLevel: number;
  currentLabel: string;
  onChange: (level: number) => void;
  disabled?: boolean;
}

export default function QualitySelector({
  levels,
  manualLevel,
  currentLabel,
  onChange,
  disabled,
}: QualitySelectorProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const sorted = sortLevelsByQuality(levels);
  const hasMultiple = levels.length > 1;

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  if (levels.length === 0) return null;

  if (!hasMultiple) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs">
        <span className="text-zinc-400">Quality</span>
        <span className="font-medium text-emerald-300">{currentLabel}</span>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs transition hover:border-emerald-400/40 hover:bg-white/10 disabled:opacity-50"
      >
        <span className="text-zinc-400">Quality</span>
        <span className="flex items-center gap-1.5 font-medium text-emerald-300">
          {currentLabel}
          <svg
            className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`}
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-xl border border-white/10 bg-[#121820] shadow-xl">
          <button
            type="button"
            onClick={() => {
              onChange(-1);
              setOpen(false);
            }}
            className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-xs hover:bg-white/5 ${
              manualLevel === -1 ? "bg-emerald-500/10 text-emerald-300" : "text-zinc-200"
            }`}
          >
            <span>Auto</span>
            {manualLevel === -1 && <span className="text-emerald-400">✓</span>}
          </button>
          {sorted.map((level) => (
            <button
              key={level.index}
              type="button"
              onClick={() => {
                onChange(level.index);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between border-t border-white/5 px-3 py-2.5 text-left text-xs hover:bg-white/5 ${
                manualLevel === level.index
                  ? "bg-emerald-500/10 text-emerald-300"
                  : "text-zinc-200"
              }`}
            >
              <span>{level.label}</span>
              {manualLevel === level.index && (
                <span className="text-emerald-400">✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
