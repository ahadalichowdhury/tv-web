"use client";

import { useEffect, useState } from "react";

const SESSION_KEY = "tv_visitor_session";
const HEARTBEAT_MS = 20_000;
const POLL_MS = 10_000;

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function useLiveVisitors() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const sessionId = getSessionId();
    if (!sessionId) return;

    const heartbeat = async () => {
      try {
        const res = await fetch("/api/visitors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        const data = await res.json();
        if (typeof data.count === "number") setCount(data.count);
      } catch {
        /* ignore */
      }
    };

    const poll = async () => {
      try {
        const res = await fetch("/api/visitors");
        const data = await res.json();
        if (typeof data.count === "number") setCount(data.count);
      } catch {
        /* ignore */
      }
    };

    heartbeat();
    const heartbeatTimer = setInterval(heartbeat, HEARTBEAT_MS);
    const pollTimer = setInterval(poll, POLL_MS);

    const leave = () => {
      fetch("/api/visitors", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
        keepalive: true,
      }).catch(() => undefined);
    };

    window.addEventListener("beforeunload", leave);
    window.addEventListener("pagehide", leave);

    return () => {
      clearInterval(heartbeatTimer);
      clearInterval(pollTimer);
      window.removeEventListener("beforeunload", leave);
      window.removeEventListener("pagehide", leave);
      leave();
    };
  }, []);

  return count;
}

interface LiveVisitorBadgeProps {
  count: number | null;
}

export default function LiveVisitorBadge({ count }: LiveVisitorBadgeProps) {
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
      </span>
      <span>
        {count === null ? "…" : count} {count === 1 ? "viewer" : "viewers"} live
      </span>
    </div>
  );
}
