/**
 * Brands Swagger UI and gives it a way out: a slim Busy Brains bar pinned above the
 * spec with who you are signed in as and a Sign out control. Swagger's own
 * topbar (a URL box for loading arbitrary specs) is hidden — it has no use here.
 */

export const docsUiCss = `
  .swagger-ui .topbar { display: none; }
  body { margin: 0; padding-top: 52px; background: #f7f7fb; }
  #bb-docs-bar {
    position: fixed;
    top: 0; left: 0; right: 0;
    z-index: 100;
    height: 52px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 18px;
    background: linear-gradient(180deg, #211a45, #171233);
    border-bottom: 1px solid #3a2f6b;
    color: #f5f3ff;
    font-family: "JetBrains Mono", ui-monospace, "SFMono-Regular", Menlo, monospace;
    font-size: 11.5px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  #bb-docs-bar .mark {
    display: grid;
    place-items: center;
    width: 30px; height: 26px;
    border: 1px solid #3a2f6b;
    border-radius: 7px;
    color: #9c6aff;
    letter-spacing: 0;
  }
  #bb-docs-bar .title { font-weight: 500; }
  #bb-docs-bar .spacer { flex: 1; }
  #bb-docs-bar .who { color: #9b8070; text-transform: none; letter-spacing: 0.04em; }
  #bb-docs-bar button {
    padding: 7px 13px;
    background: transparent;
    border: 1px solid #3a2f6b;
    border-radius: 8px;
    color: #9c6aff;
    font: inherit;
    cursor: pointer;
    transition: background 140ms ease, border-color 140ms ease;
  }
  #bb-docs-bar button:hover { background: #2f1704; border-color: #9c6aff; }
  #bb-docs-bar button:focus-visible { outline: 2px solid #9c6aff; outline-offset: 2px; }
  @media (max-width: 560px) {
    #bb-docs-bar .title { display: none; }
  }
  @media (prefers-reduced-motion: reduce) {
    #bb-docs-bar button { transition: none; }
  }
`;

export function docsUiScript(prefix: string): string {
  return `
  (function () {
    var bar = document.createElement('div');
    bar.id = 'bb-docs-bar';
    bar.innerHTML =
      '<span class="mark">BB</span>' +
      '<span class="title">Busy Brains API &middot; docs</span>' +
      '<span class="spacer"></span>' +
      '<span class="who" id="bb-docs-who"></span>' +
      '<form method="post" action="${prefix}/logout"><button type="submit">Sign out</button></form>';
    document.body.insertBefore(bar, document.body.firstChild);

    fetch('${prefix}/session', { headers: { accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (s) {
        if (s && s.user) document.getElementById('bb-docs-who').textContent = 'signed in as ' + s.user;
      })
      .catch(function () {});
  })();
  `;
}
