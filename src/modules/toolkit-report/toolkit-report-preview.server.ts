import { createServer } from "http";
import {
  buildToolkitReportHtml,
  DashboardData,
} from "../../common/toolkit-report-html.util";
import { resolve } from "path";

/**
 * Standalone preview server for the toolkit report HTML.
 *
 * Usage (from project root):
 *   npx ts-node src/modules/toolkit-report/toolkit-report-preview.server.ts
 *
 * Or after build:
 *   node dist/modules/toolkit-report/toolkit-report-preview.server.js
 *
 * Environment variables:
 *   - PORT          : server port (default 3456)
 *   - ASSETS_DIR    : override assets directory (default: __dirname + "/assets")
 *
 * The server renders the report with static sample data and serves it at:
 *   http://localhost:<PORT>/
 *
 * It also exposes /reload so you can hit it with curl to force a fresh render
 * (useful when iterating on the HTML template).
 */

const PORT = Number(process.env.PORT || 4444);

// Resolve assets directory — works for both src/ and dist/ layouts.
const ASSETS_DIR = process.env.ASSETS_DIR
  ? resolve(process.env.ASSETS_DIR)
  : resolve(__dirname, "assets");

// ---------------------------------------------------------------------------
// Sample static data (same shape as a real child's dashboard payload)
// ---------------------------------------------------------------------------

const SAMPLE_DASHBOARD: DashboardData = {
  brain_data: {
    status: "completed",
    type: "Cozy + Fidget Brain Combo",
    counts: { A: 0, B: 2, C: 2, D: 1 },
  },
  tactile_data: {
    status: "completed",
    type: "Touch Detective + Touch on Your Terms Combo",
    counts: { A: 2, B: 3, C: 3 },
  },
  favourite_tools_data: {
    status: "completed",
    data: {
      module_5_quest_1_saved_toolkit: [
        {
          toolFlag: "movement",
          list: [
            { title: "5 slow belly breaths" },
            { title: "Wall push-ups" },
            { title: "Hug a pillow or teddy" },
            { title: "Squeeze putty or playdough" },
            { title: "Draw or colour" },
            { title: "Chill time" },
          ],
        },
      ],
    },
  },
  final_toolkit_data: {
    status: "completed",
    data: { module_5_quest_3_screen_2_quiz_counts: { A: 3, B: 2, C: 3 } },
  },
};

const SAMPLE_CHILD_NAME = "Ayesha";

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

let cachedHtml: string | null = null;

function renderHtml(): string {
  return buildToolkitReportHtml({
    assetsDir: ASSETS_DIR,
    childName: SAMPLE_CHILD_NAME,
    dashboard: SAMPLE_DASHBOARD,
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
    `Toolkit Report Preview Server running at http://localhost:${PORT}`,
  );
  console.log(`Assets directory: ${ASSETS_DIR}`);
  console.log(`Endpoints:`);
  console.log(`  GET /         → Rendered HTML preview`);
  console.log(`  GET /reload   → Clear cache & force re-render`);
  console.log(`  GET /health   → Health check`);
  console.log(
    `\nTip: Edit the template in src/common/toolkit-report-html.util.ts, then hit /reload.`,
  );
});
