import { createHmac, timingSafeEqual } from "node:crypto";

export const DOCS_COOKIE = "busybrains_docs";
/** A docs session lasts one working day; re-auth is cheap. */
const SESSION_TTL_SECONDS = 8 * 60 * 60;

/** Constant-time compare that does not leak length through an early exit. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) {
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/**
 * Stateless session token: base64url(JSON).HMAC. Nothing is stored server-side,
 * so the token survives restarts and multiple API instances without shared state.
 */
export function issueSession(
  user: string,
  secret: string,
): { value: string; maxAge: number } {
  const payload = Buffer.from(
    JSON.stringify({
      u: user,
      exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
    }),
    "utf8",
  ).toString("base64url");
  return {
    value: `${payload}.${sign(payload, secret)}`,
    maxAge: SESSION_TTL_SECONDS,
  };
}

/** Returns the signed-in user name, or null when the token is absent, forged or expired. */
export function readSession(
  token: string | undefined,
  secret: string,
): string | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot < 1) return null;

  const payload = token.slice(0, dot);
  if (!safeEqual(token.slice(dot + 1), sign(payload, secret))) return null;

  try {
    const claims = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as {
      u?: unknown;
      exp?: unknown;
    };
    if (typeof claims.u !== "string" || typeof claims.exp !== "number")
      return null;
    if (claims.exp <= Math.floor(Date.now() / 1000)) return null;
    return claims.u;
  } catch {
    return null;
  }
}

export function readCookie(
  header: string | undefined,
  name: string,
): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name)
      return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return undefined;
}
