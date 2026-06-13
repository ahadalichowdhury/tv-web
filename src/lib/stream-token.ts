import crypto from "crypto";

const TOKEN_TTL_MS = 4 * 60 * 60 * 1000;

export const DIRECT_STREAM_CHANNEL_ID = "__network__";

export interface StreamTokenPayload {
  channelId: string;
  streamIndex: number;
  url?: string;
  referer?: string;
  userAgent?: string;
  origin?: string;
  cookie?: string;
  exp: number;
}

export interface StreamProxyContext {
  channelId: string;
  streamIndex: number;
  referer?: string;
  userAgent?: string;
  origin?: string;
  cookie?: string;
}

function getSecret(): string {
  return process.env.PLAYBACK_SECRET || process.env.ADMIN_PASSWORD || "change-me";
}

function sign(encoded: string): string {
  return crypto.createHmac("sha256", getSecret()).update(encoded).digest("base64url");
}

export function createStreamToken(
  payload: Omit<StreamTokenPayload, "exp"> & { exp?: number }
): string {
  const full: StreamTokenPayload = {
    channelId: payload.channelId,
    streamIndex: payload.streamIndex,
    url: payload.url,
    referer: payload.referer,
    userAgent: payload.userAgent,
    origin: payload.origin,
    cookie: payload.cookie,
    exp: payload.exp ?? Date.now() + TOKEN_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(full)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function verifyStreamToken(token: string | null): StreamTokenPayload | null {
  if (!token?.includes(".")) return null;

  const [encoded, sig] = token.split(".");
  if (!encoded || !sig) return null;

  const expected = sign(encoded);
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
      typeof payload.exp !== "number" ||
      Date.now() > payload.exp
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function buildChannelStreamUrl(channelId: string, streamIndex: number): string {
  const params = new URLSearchParams({
    channelId,
    streamIndex: String(streamIndex),
  });
  return `/api/stream?${params}`;
}

export function buildStreamProxyPath(ctx: StreamProxyContext, upstreamUrl?: string): string {
  const token = createStreamToken({
    channelId: ctx.channelId,
    streamIndex: ctx.streamIndex,
    url: upstreamUrl,
    referer: ctx.referer,
    userAgent: ctx.userAgent,
    origin: ctx.origin,
    cookie: ctx.cookie,
  });
  return `/api/stream?t=${token}`;
}
