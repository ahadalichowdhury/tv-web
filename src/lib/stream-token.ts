import crypto from "crypto";

const TOKEN_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

export interface StreamTokenPayload {
  channelId: string;
  streamIndex: number;
  url?: string;
  exp: number;
}

function getSecret(): string {
  const secret =
    process.env.PLAYBACK_SECRET ||
    process.env.ADMIN_PASSWORD ||
    "change-me-in-production";
  return secret;
}

function signPayload(encoded: string): string {
  return crypto.createHmac("sha256", getSecret()).update(encoded).digest("base64url");
}

export function createStreamToken(
  payload: Omit<StreamTokenPayload, "exp"> & { exp?: number }
): string {
  const full: StreamTokenPayload = {
    channelId: payload.channelId,
    streamIndex: payload.streamIndex,
    url: payload.url,
    exp: payload.exp ?? Date.now() + TOKEN_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(full)).toString("base64url");
  const sig = signPayload(encoded);
  return `${encoded}.${sig}`;
}

export function verifyStreamToken(token: string | null): StreamTokenPayload | null {
  if (!token || !token.includes(".")) return null;

  const [encoded, sig] = token.split(".");
  if (!encoded || !sig) return null;

  const expected = signPayload(encoded);
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf-8")
    ) as StreamTokenPayload;

    if (
      !payload.channelId ||
      typeof payload.streamIndex !== "number" ||
      typeof payload.exp !== "number"
    ) {
      return null;
    }

    if (Date.now() > payload.exp) return null;

    return payload;
  } catch {
    return null;
  }
}

export function buildStreamProxyPath(
  channelId: string,
  streamIndex: number,
  upstreamUrl?: string
): string {
  const token = createStreamToken({
    channelId,
    streamIndex,
    url: upstreamUrl,
  });
  return `/api/stream?t=${token}`;
}
