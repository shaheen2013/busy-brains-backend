/**
 * The docs gate, rendered server-side (no bundle, no client framework).
 *
 * Design: Busy Brains' own palette — indigo ground, violet signal — with
 * the card built to read like the HTTP challenge it actually is: the status
 * line is printed in mono at the top, then the human form beneath it.
 */

type LoginPageOptions = {
  /** Path the form posts to. */
  action: string;
  /** Where to send the reader once they are in. */
  next: string;
  environment: string;
  version: string;
  error?: string;
  /** Pre-fills the user field after a failed attempt so only the password is retyped. */
  user?: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderLoginPage(options: LoginPageOptions): string {
  const { action, next, environment, version, error, user = "" } = options;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>Sign in — Busy Brains API docs</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet" />
<style>
  :root {
    --ground: #171233;
    --ground-lift: #211a45;
    --edge: #3a2f6b;
    --violet: #9c6aff;
    --teal: #6cc5c6;
    --coral: #f77f6a;
    --paper: #f5f3ff;
    --muted: #9ca3af;
    --display: "Space Grotesk", "Segoe UI", system-ui, sans-serif;
    --mono: "JetBrains Mono", ui-monospace, "SFMono-Regular", Menlo, monospace;
  }
  * { box-sizing: border-box; }
  html {
    background: #0d0a1c;
  }
  body {
    margin: 0;
    min-height: 100dvh;
    display: grid;
    place-items: center;
    padding: 32px 20px;
    background:
      radial-gradient(120% 90% at 50% -10%, #2e2263 0%, var(--ground) 55%, #0d0a1c 100%);
    color: var(--paper);
    font-family: var(--display);
    -webkit-font-smoothing: antialiased;
  }
  .mark {
    display: flex;
    align-items: center;
    gap: 10px;
    justify-content: center;
    margin-bottom: 22px;
    font-family: var(--mono);
    font-size: 11px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .mark span:first-child {
    display: grid;
    place-items: center;
    width: 30px;
    height: 26px;
    border: 1px solid var(--edge);
    border-radius: 7px;
    color: var(--violet);
    font-weight: 500;
    letter-spacing: 0;
  }
  .slip {
    width: 100%;
    max-width: 420px;
    background: linear-gradient(180deg, var(--ground-lift), #191340);
    border: 1px solid var(--edge);
    border-radius: 14px;
    overflow: hidden;
    box-shadow: 0 30px 70px -40px #05030f;
  }
  /* The signature: the challenge itself, printed. One violet hairline sweeps in. */
  .challenge {
    padding: 18px 24px 16px;
    font-family: var(--mono);
    font-size: 11.5px;
    line-height: 1.7;
    color: var(--muted);
    border-bottom: 1px solid var(--edge);
    position: relative;
  }
  .challenge b { color: var(--violet); font-weight: 500; }
  .challenge.failed b { color: var(--coral); }
  .challenge::after {
    content: "";
    position: absolute;
    left: 0; right: 0; bottom: -1px;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--violet), transparent);
    transform-origin: left;
    animation: sweep 900ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
  }
  .challenge.failed::after { background: linear-gradient(90deg, transparent, var(--coral), transparent); }
  @keyframes sweep { from { transform: scaleX(0); opacity: 0; } to { transform: scaleX(1); opacity: 1; } }
  .body { padding: 26px 24px 24px; }
  h1 {
    margin: 0 0 8px;
    font-size: 21px;
    font-weight: 700;
    letter-spacing: -0.015em;
  }
  p.lede { margin: 0 0 22px; font-size: 13.5px; line-height: 1.6; color: var(--muted); }
  label {
    display: block;
    margin-bottom: 7px;
    font-family: var(--mono);
    font-size: 10.5px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .field { margin-bottom: 18px; }
  input {
    width: 100%;
    padding: 11px 13px;
    background: #100c26;
    border: 1px solid var(--edge);
    border-radius: 9px;
    color: var(--paper);
    font-family: var(--mono);
    font-size: 14px;
  }
  input:hover { border-color: #574aa0; }
  input:focus-visible { outline: 2px solid var(--violet); outline-offset: 2px; border-color: var(--violet); }
  button {
    width: 100%;
    padding: 12px 16px;
    background: var(--violet);
    border: 0;
    border-radius: 9px;
    color: #14102b;
    font-family: var(--display);
    font-size: 14.5px;
    font-weight: 700;
    letter-spacing: -0.01em;
    cursor: pointer;
    transition: background 140ms ease, transform 140ms ease;
  }
  button:hover { background: #b189ff; }
  button:active { transform: translateY(1px); }
  button:focus-visible { outline: 2px solid var(--paper); outline-offset: 2px; }
  .alert {
    margin: 0 0 18px;
    padding: 11px 13px;
    border: 1px solid #7a3b31;
    border-left: 3px solid var(--coral);
    border-radius: 0 9px 9px 0;
    background: #2e1712;
    color: #ffe4de;
    font-size: 13px;
    line-height: 1.55;
  }
  footer {
    margin-top: 20px;
    text-align: center;
    font-family: var(--mono);
    font-size: 10.5px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #5b5382;
  }
  @media (prefers-reduced-motion: reduce) {
    .challenge::after { animation: none; }
    button { transition: none; }
  }
</style>
</head>
<body>
  <main>
    <div class="mark"><span>BB</span><span>Busy Brains API</span></div>

    <div class="slip">
      <div class="challenge${error ? " failed" : ""}">
        <b>HTTP/1.1 401 Unauthorized</b><br />
        WWW-Authenticate: Basic realm="Busy Brains API docs"<br />
        Vary: Cookie
      </div>

      <div class="body">
        <h1>Sign in to read the docs</h1>
        <p class="lede">The OpenAPI reference is private. Use the docs credentials for this environment.</p>

        ${error ? `<p class="alert" role="alert">${escapeHtml(error)}</p>` : ""}

        <form method="post" action="${escapeHtml(action)}" autocomplete="off">
          <input type="hidden" name="next" value="${escapeHtml(next)}" />
          <div class="field">
            <label for="user">User</label>
            <input id="user" name="user" value="${escapeHtml(user)}" autocapitalize="off" spellcheck="false"${error ? "" : " autofocus"} required />
          </div>
          <div class="field">
            <label for="password">Password</label>
            <input id="password" name="password" type="password"${error ? " autofocus" : ""} required />
          </div>
          <button type="submit">Open the docs</button>
        </form>
      </div>
    </div>

    <footer>${escapeHtml(environment)} &middot; v${escapeHtml(version)}</footer>
  </main>
</body>
</html>`;
}
