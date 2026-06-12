/** Headers that help long-lived streams work behind Cloudflare Tunnel / reverse proxies */
export function applyStreamProxyHeaders(headers: Headers) {
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Cache-Control", "no-store, no-cache");
  headers.set("Connection", "keep-alive");
  headers.set("X-Accel-Buffering", "no");
}
