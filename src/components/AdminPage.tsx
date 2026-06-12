"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminPanel from "@/components/AdminPanel";
import type { Playlist } from "@/lib/types";

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const checkAuth = async () => {
    const res = await fetch("/api/admin/verify");
    const data = await res.json();
    setAuthenticated(data.authenticated);
  };

  const loadPlaylists = async () => {
    const res = await fetch("/api/playlists");
    setPlaylists(await res.json());
  };

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (authenticated) loadPlaylists();
  }, [authenticated]);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Login failed");
      }
      setAuthenticated(true);
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await fetch("/api/admin/login", { method: "DELETE" });
    setAuthenticated(false);
  };

  if (authenticated === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b0f14]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0f14] text-zinc-100">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-xl font-bold">Admin Panel</h1>
            <p className="text-sm text-zinc-400">Manage M3U playlists</p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/"
              className="rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5"
            >
              ← Back to TV
            </Link>
            {authenticated && (
              <button
                type="button"
                onClick={logout}
                className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
              >
                Logout
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        {!authenticated ? (
          <form
            onSubmit={login}
            className="mx-auto max-w-sm space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6"
          >
            <h2 className="text-lg font-semibold">Admin Login</h2>
            <p className="text-sm text-zinc-400">
              Default password is <code className="text-emerald-400">admin123</code> — change it
              via <code className="text-zinc-300">ADMIN_PASSWORD</code> env variable.
            </p>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-emerald-400"
              required
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-emerald-500 py-2.5 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        ) : (
          <AdminPanel playlists={playlists} onUpdate={loadPlaylists} />
        )}
      </main>
    </div>
  );
}
