/**
 * AES-256-GCM encryption/decryption for API responses.
 *
 * Uses the Web Crypto API which is available natively in both the browser
 * and Node.js 18+ / Next.js Edge runtime — no extra dependencies required.
 *
 * The key is shared via NEXT_PUBLIC_CHANNELS_KEY so the client can decrypt.
 * This prevents casual network-tab inspection; a determined reverse-engineer
 * who reads the compiled bundle could still extract the key.
 */

const KEY_ENV = process.env.NEXT_PUBLIC_CHANNELS_KEY ?? "";

function fromBase64(str: string): Uint8Array<ArrayBuffer> {
  const binary = atob(str);
  const buf = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Cached CryptoKey promise — importKey() is expensive (async crypto op).
 * Resolving the same promise on every call eliminates repeated key-import
 * overhead on both the server (each API request) and the client (each poll).
 */
let _keyPromise: Promise<CryptoKey> | null = null;

function getKey(): Promise<CryptoKey> {
  if (!KEY_ENV) throw new Error("NEXT_PUBLIC_CHANNELS_KEY is not set");
  if (!_keyPromise) {
    const raw = fromBase64(KEY_ENV);
    _keyPromise = crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, [
      "encrypt",
      "decrypt",
    ]);
  }
  return _keyPromise;
}

/** Loop-based base64 encode — safe for large buffers (no spread/stack limit). */
function toBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/** Encrypt any JSON-serialisable value. Returns `{ d, iv }` — both base64. */
export async function encryptPayload(data: unknown): Promise<{ d: string; iv: string }> {
  const [key, encoded] = await Promise.all([
    getKey(),
    Promise.resolve(new TextEncoder().encode(JSON.stringify(data))),
  ]);
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for AES-GCM
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  return { d: toBase64(ciphertext), iv: toBase64(iv) };
}

/** Decrypt a `{ d, iv }` payload produced by `encryptPayload`. */
export async function decryptPayload<T>(payload: { d: string; iv: string }): Promise<T> {
  const [key, iv, ciphertext] = await Promise.all([
    getKey(),
    Promise.resolve(fromBase64(payload.iv)),
    Promise.resolve(fromBase64(payload.d)),
  ]);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return JSON.parse(new TextDecoder().decode(decrypted)) as T;
}
