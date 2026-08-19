import type { NextFunction, Request, Response } from "express";
import { renderLoginPage } from "./login-page";
import {
  DOCS_COOKIE,
  issueSession,
  readCookie,
  readSession,
  safeEqual,
} from "./session";

export type DocsAuthOptions = {
  user: string;
  password: string;
  /** Key the session HMAC is derived from; rotating it invalidates every session. */
  secret: string;
  environment: string;
  version: string;
  /** Cookies are only marked Secure where TLS terminates in front of the API. */
  secureCookie: boolean;
  /** Mount path of Swagger UI. */
  prefix?: string;
};

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

/** Per-process attempt counter. Slows credential stuffing without adding state to share. */
const attempts = new Map<string, { count: number; firstAt: number }>();

function throttle(ip: string): { blocked: boolean; minutesLeft: number } {
  const record = attempts.get(ip);
  if (!record) return { blocked: false, minutesLeft: 0 };
  const elapsed = Date.now() - record.firstAt;
  if (elapsed > LOCKOUT_MS) {
    attempts.delete(ip);
    return { blocked: false, minutesLeft: 0 };
  }
  return {
    blocked: record.count >= MAX_ATTEMPTS,
    minutesLeft: Math.max(1, Math.ceil((LOCKOUT_MS - elapsed) / 60000)),
  };
}

function recordFailure(ip: string): void {
  const record = attempts.get(ip);
  if (record && Date.now() - record.firstAt <= LOCKOUT_MS) record.count += 1;
  else attempts.set(ip, { count: 1, firstAt: Date.now() });
}

function basicCredentials(
  header: string | undefined,
): { user: string; pass: string } | null {
  if (!header?.startsWith("Basic ")) return null;
  const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  const sep = decoded.indexOf(":");
  if (sep < 0) return null;
  return { user: decoded.slice(0, sep), pass: decoded.slice(sep + 1) };
}

/**
 * Gates every Swagger route. Browsers get the sign-in page and a session
 * cookie; scripts and curl can still authenticate with an `Authorization:
 * Basic` header, so CI and one-off `curl -u` calls keep working.
 */
export function docsAuthMiddleware(options: DocsAuthOptions) {
  const prefix = options.prefix ?? "/api/docs";
  const loginPath = `${prefix}/login`;

  const credentialsMatch = (user: string, pass: string) =>
    safeEqual(user, options.user) && safeEqual(pass, options.password);

  // Only ever redirect back inside the docs, so `next` cannot become an open redirect.
  const safeNext = (value: unknown): string =>
    typeof value === "string" &&
    value.startsWith(prefix) &&
    !value.startsWith("//")
      ? value
      : prefix;

  const sendLogin = (
    res: Response,
    next: string,
    status: number,
    error?: string,
    user?: string,
  ) =>
    res
      .status(status)
      .type("html")
      .send(
        renderLoginPage({
          action: loginPath,
          next,
          environment: options.environment,
          version: options.version,
          error,
          user,
        }),
      );

  return (req: Request, res: Response, nextFn: NextFunction) => {
    if (!req.path.startsWith(prefix)) return nextFn();

    const sessionUser = readSession(
      readCookie(req.headers.cookie, DOCS_COOKIE),
      options.secret,
    );

    if (req.path === loginPath) {
      if (sessionUser) return res.redirect(302, prefix);

      if (req.method !== "POST")
        return sendLogin(res, safeNext(req.query.next), 200);

      const body = (req.body ?? {}) as Record<string, unknown>;
      const target = safeNext(body.next);
      const submittedUser = typeof body.user === "string" ? body.user : "";
      const submittedPass =
        typeof body.password === "string" ? body.password : "";
      const ip = req.ip ?? "unknown";

      const limit = throttle(ip);
      if (limit.blocked) {
        return sendLogin(
          res,
          target,
          429,
          `Too many attempts. Try again in ${limit.minutesLeft} minute${limit.minutesLeft === 1 ? "" : "s"}.`,
          submittedUser,
        );
      }

      if (!credentialsMatch(submittedUser, submittedPass)) {
        recordFailure(ip);
        return sendLogin(
          res,
          target,
          401,
          "Those credentials do not match. Check DOCS_USER and DOCS_PASSWORD for this environment.",
          submittedUser,
        );
      }

      attempts.delete(ip);
      const session = issueSession(submittedUser, options.secret);
      res.cookie(DOCS_COOKIE, session.value, {
        httpOnly: true,
        sameSite: "lax",
        secure: options.secureCookie,
        maxAge: session.maxAge * 1000,
        path: "/",
      });
      return res.redirect(302, target);
    }

    if (req.path === `${prefix}/logout`) {
      res.clearCookie(DOCS_COOKIE, { path: "/" });
      return res.redirect(302, loginPath);
    }

    if (req.path === `${prefix}/session`) {
      if (!sessionUser) return res.status(401).json({ ok: false });
      return res.json({ ok: true, user: sessionUser });
    }

    if (sessionUser) return nextFn();

    const basic = basicCredentials(req.headers.authorization);
    if (basic && credentialsMatch(basic.user, basic.pass)) return nextFn();

    // Browsers land on the branded sign-in page; everything else gets the
    // protocol-level challenge so `curl -u` and CI clients still work. The
    // Accept header must name text/html explicitly — req.accepts("html")
    // also matches the */* that clients with no Accept header send.
    const wantsHtml = (req.headers.accept ?? "").includes("text/html");
    if (req.method === "GET" && wantsHtml) {
      return res.redirect(
        302,
        `${loginPath}?next=${encodeURIComponent(req.originalUrl)}`,
      );
    }
    res.setHeader(
      "WWW-Authenticate",
      'Basic realm="Busy Brains API docs", charset="UTF-8"',
    );
    return res
      .status(401)
      .json({ ok: false, error: "Docs authentication required" });
  };
}
