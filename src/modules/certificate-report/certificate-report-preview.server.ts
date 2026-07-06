import { createServer } from "http";
import { buildCertificateHtml } from "../../common/certificate-html.util";
import { resolve } from "path";

/**
 * Standalone preview server for the certificate HTML.
 *
 * Usage (from project root):
 *   npx ts-node src/modules/certificate-report/certificate-report-preview.server.ts
 *
 * Or after build:
 *   node dist/modules/certificate-report/certificate-report-preview.server.js
 *
 * Environment variables:
 *   - PORT          : server port (default 4445)
 *   - ASSETS_DIR    : override assets directory (default: __dirname + "/assets")
 *
 * The server renders the certificate with static sample data and serves it at:
 *   http://localhost:<PORT>/
 *
 * It also exposes /reload so you can hit it with curl to force a fresh render
 * (useful when iterating on the HTML template).
 */

const PORT = Number(process.env.PORT || 4445);

const ASSETS_DIR = process.env.ASSETS_DIR
  ? resolve(process.env.ASSETS_DIR)
  : resolve(__dirname, "assets");

const SAMPLE_CHILD_NAME = "Molla Abu Taher";
const SAMPLE_COMPLETED_AT = new Date("2026-05-08T00:00:00.000Z");

let cachedHtml: string | null = null;

function renderHtml(): string {
  return buildCertificateHtml({
    assetsDir: ASSETS_DIR,
    childName: SAMPLE_CHILD_NAME,
    completedAt: SAMPLE_COMPLETED_AT,
  });
}

const server = createServer((req, res) => {
  const url = req.url || "/";

  if (url === "/health" || url === "/health/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, assetsDir: ASSETS_DIR }));
    return;
  }

  if (url === "/reload" || url === "/reload/") {
    cachedHtml = null;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        message: "Cache cleared. Refresh / to see changes.",
      }),
    );
    return;
  }

  if (url === "/" || url === "/index.html") {
    const html = cachedHtml ?? renderHtml();
    cachedHtml = html;

    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(html);
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found. Try /");
});

server.listen(PORT, () => {
  console.log(
    `Certificate Report Preview Server running at http://localhost:${PORT}`,
  );
  console.log(`Assets directory: ${ASSETS_DIR}`);
  console.log(`Endpoints:`);
  console.log(`  GET /         → Rendered HTML preview`);
  console.log(`  GET /reload   → Clear cache & force re-render`);
  console.log(`  GET /health   → Health check`);
  console.log(
    `\nTip: Edit the template in src/common/certificate-html.util.ts, then hit /reload.`,
  );
});
