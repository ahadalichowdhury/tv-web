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

/** Import the base64-encoded 32-byte key as a CryptoKey. */
async function importKey(): Promise<CryptoKey> {
  if (!KEY_ENV) {
    throw new Error("NEXT_PUBLIC_CHANNELS_KEY is not set");
  }
  const raw = Uint8Array.from(atob(KEY_ENV), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

function toBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(str: string): Uint8Array<ArrayBuffer> {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length) as Uint8Array<ArrayBuffer>;
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Encrypt any JSON-serialisable value. Returns `{ d, iv }` — both base64. */
export async function encryptPayload(data: unknown): Promise<{ d: string; iv: string }> {
  const key = await importKey();
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for AES-GCM
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  return { d: toBase64(ciphertext), iv: toBase64(iv) };
}

/** Decrypt a `{ d, iv }` payload produced by `encryptPayload`. */
export async function decryptPayload<T>(payload: { d: string; iv: string }): Promise<T> {
  const key = await importKey();
  const iv = fromBase64(payload.iv);
  const ciphertext = fromBase64(payload.d);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return JSON.parse(new TextDecoder().decode(decrypted)) as T;
}
