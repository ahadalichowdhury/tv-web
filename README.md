# Live TV Web App

A web-based IPTV player where admins can add M3U playlists (via URL or file upload) and users can browse and watch live channels.

## Features

- **Admin panel** (`/admin`) — add playlists from URL (e.g. Pastebin raw links) or upload/paste M3U content
- **Channel browser** — channels grouped by category with search and filters
- **HLS playback** — uses HLS.js with a built-in proxy for custom User-Agent / Referer headers
- **Multiple stream sources** — channels with backup URLs can switch sources
- **Refresh playlists** — re-fetch URL-based playlists to update channels

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the TV viewer.

Open [http://localhost:3000/admin](http://localhost:3000/admin) to manage playlists.

**Default admin password:** `admin123`

Change it by setting the environment variable:

```bash
ADMIN_PASSWORD=your-secure-password npm run dev
```

## Adding a Playlist

1. Go to `/admin` and sign in
2. Choose **From URL** and paste e.g. `https://pastebin.com/raw/5h0UZAyZ`
3. Or choose **Upload M3U** to upload a `.m3u` file or paste content directly

## Notes

- Only **HLS (.m3u8)** streams are supported in the browser player
- **DASH (.mpd)** and DRM-protected streams cannot play in a standard web browser
- Some streams may be geo-blocked or offline — use alternate sources when available
- Data is stored locally in `data/store.json`

## Tech Stack

- Next.js 16 + TypeScript
- Tailwind CSS
- HLS.js
- JSON file storage
