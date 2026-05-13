import { Injectable } from "@nestjs/common";
import { readFileSync } from "fs";
import { join } from "path";
import puppeteer from "puppeteer";
import {
  ToolkitType,
  ToolkitTypeData,
  ToolkitImage,
} from "./toolkit-report.types";
import { TOOLKIT_DATA } from "./toolkit-report.constants";

@Injectable()
export class ToolkitReportService {
  // Change these to test different types / names before DB integration
  private readonly toolkitType: ToolkitType = "balanced";
  private readonly childName = "Tuhin";

  async generatePdf(): Promise<Buffer> {
    const data = TOOLKIT_DATA[this.toolkitType];
    const html = this.buildHtml(this.childName, data);

    const executablePath =
      process.env.PUPPETEER_EXECUTABLE_PATH ||
      process.env.CHROME_BIN ||
      undefined;

    const browser = await puppeteer.launch({
      headless: true,
      executablePath,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
    });

    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 794, height: 1123 });
      await page.setContent(html, { waitUntil: "load" });

      const contentHeight = await page.evaluate(
        () => document.documentElement.scrollHeight,
      );

      const pdf = await page.pdf({
        width: "794px",
        height: `${contentHeight}px`,
        printBackground: true,
        margin: { top: "0", right: "0", bottom: "0", left: "0" },
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  private loadAsset(relativePath: string): string {
    const fullPath = join(__dirname, "assets", relativePath);
    const ext = relativePath.split(".").pop();
    const mime = ext === "svg" ? "image/svg+xml" : `image/${ext}`;
    const data = readFileSync(fullPath).toString("base64");
    return `data:${mime};base64,${data}`;
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  private buildImageGrid(images: ToolkitImage[]): string {
    return images
      .map((img) => {
        const src = this.loadAsset(`images/${img.imageFile}`);
        return `
          <div class="img-item">
            <img class="img-thumb" src="${src}" alt="${this.escapeHtml(img.label)}" />
            <div class="img-label">${this.escapeHtml(img.label)}</div>
            <div class="img-desc">${this.escapeHtml(img.description)}</div>
          </div>`;
      })
      .join("");
  }

  private buildHtml(childName: string, data: ToolkitTypeData): string {
    const { brainType, tactileSense, favouriteTools, toolkitInfo, images } =
      data;

    const logoSrc = this.loadAsset("logo.svg");
    const heroSrc = this.loadAsset("hero-child.svg");
    const brainIconSrc = this.loadAsset("icons/brain.svg");
    const tactileIconSrc = this.loadAsset("icons/tactile.svg");
    const toolsIconSrc = this.loadAsset("icons/tools.svg");
    const toolkitIconSrc = this.loadAsset("icons/toolkit.svg");

    const toolTags = favouriteTools.tools
      .map(
        (tool, i) =>
          `<span class="tool-tag color-${i % 4}">${this.escapeHtml(tool)}</span>`,
      )
      .join("");

    const needTags = toolkitInfo.needs
      .map((need) => `<span class="need-tag">${this.escapeHtml(need)}</span>`)
      .join("");

    const bulletPoints = tactileSense.bulletPoints
      .map((p) => `<li>${this.escapeHtml(p)}</li>`)
      .join("");

    const imageGrid = this.buildImageGrid(images);

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Helvetica Neue', Arial, sans-serif;
    background: #f8f6f3;
    color: #1a1a2e;
    font-size: 13px;
  }

  /* ── Page header ── */
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0px;
    background: white;
    border-bottom: 1px solid #eee;
  }
  .logo { height: 36px; }
  .page-title { font-size: 18px; font-weight: 700; color: #1a1a2e; }

  /* ── Main content wrapper ── */
  .content { padding: 14px 0; display: flex; flex-direction: column; gap: 12px; }

  /* ── Shared card ── */
  .card {
    border: 2px solid #c4a8e0;
    border-radius: 18px;
    overflow: hidden;
    background: white;
  }

  /* ── Toolkit card header ── */
  .card-hero {
    background: linear-gradient(135deg, #ede9fe 0%, #e0f2fe 100%);
    padding: 16px 22px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  .hero-badge {
    display: inline-block;
    background: #7c3aed;
    color: white;
    font-size: 10px;
    font-weight: 600;
    padding: 2px 10px;
    border-radius: 20px;
    margin-bottom: 6px;
  }
  .hero-title { font-size: 20px; font-weight: 900; color: #1a1a2e; line-height: 1.2; }
  .hero-title .child-name { color: #22c55e; }
  .hero-subtitle { font-size: 10px; color: #64748b; margin-top: 4px; }
  .hero-img { width: 80px; height: 80px; object-fit: contain; }

  /* ── Two-column info row ── */
  .two-col { display: grid; grid-template-columns: 1fr 1fr; border-top: 1px solid #e9d5ff; }
  .col-cell { padding: 14px 18px; }
  .col-cell + .col-cell { border-left: 1px solid #e9d5ff; }
  .col-cell.green-bg { background: #f0fdf4; }
  .col-cell.purple-bg { background: #faf5ff; }

  .cell-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
  .cell-icon { width: 28px; height: 28px; object-fit: contain; flex-shrink: 0; }
  .cell-label { font-size: 11px; font-weight: 700; color: #1a1a2e; }
  .cell-sublabel { font-size: 9px; color: #94a3b8; }
  .cell-title { font-size: 13px; font-weight: 800; color: #1a1a2e; margin-bottom: 5px; }
  .cell-body { font-size: 9.5px; color: #475569; line-height: 1.55; }
  .bullet-list { list-style: none; padding: 0; }
  .bullet-list li {
    font-size: 9.5px; color: #475569; line-height: 1.5;
    padding-left: 10px; position: relative;
  }
  .bullet-list li::before { content: '•'; position: absolute; left: 0; color: #94a3b8; }

  /* ── Tool tags ── */
  .tools-section-title { font-size: 10px; font-weight: 700; color: #166534; margin: 4px 0 6px; }
  .tag-wrap { display: flex; flex-wrap: wrap; gap: 4px; }
  .tool-tag { font-size: 8.5px; padding: 3px 9px; border-radius: 12px; font-weight: 500; }
  .tool-tag.color-0 { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
  .tool-tag.color-1 { background: #d1fae5; color: #065f46; border: 1px solid #a7f3d0; }
  .tool-tag.color-2 { background: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe; }
  .tool-tag.color-3 { background: #fce7f3; color: #9d174d; border: 1px solid #fbcfe8; }

  /* ── Needs tags ── */
  .needs-title { font-size: 9.5px; font-weight: 700; color: #555; margin: 8px 0 5px; }
  .need-tag {
    display: inline-block; background: #1e1b4b; color: white;
    font-size: 8px; padding: 3px 9px; border-radius: 12px; margin: 2px;
  }

  /* ── Final toolkit section ── */
  .final-card {
    border: 2px solid #ddd6fe;
    border-radius: 18px;
    overflow: hidden;
    background: white;
    padding: 18px 20px;
  }
  .final-header { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 10px; }
  .final-icon {
    width: 36px; height: 36px; background: #fef9c3;
    border-radius: 10px; display: flex; align-items: center;
    justify-content: center; font-size: 18px; flex-shrink: 0;
  }
  .final-title { font-size: 17px; font-weight: 900; color: #1a1a2e; }
  .final-subtitle { font-size: 9.5px; color: #94a3b8; margin-top: 1px; }
  .toolkit-row { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
  .toolkit-name { font-size: 12px; font-weight: 800; color: #1a1a2e; }
  .primary-badge {
    background: #fef08a; color: #713f12;
    font-size: 8px; font-weight: 700; padding: 2px 8px; border-radius: 10px;
  }

  /* ── Image grid ── */
  .img-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; }
  .img-item { display: flex; flex-direction: column; align-items: center; text-align: center; }
  .img-thumb { width: 88px; height: 88px; border-radius: 12px; object-fit: contain; margin-bottom: 5px; }
  .img-label { font-size: 8.5px; font-weight: 700; color: #1a1a2e; line-height: 1.3; }
  .img-desc { font-size: 7.5px; color: #94a3b8; line-height: 1.3; margin-top: 2px; }

  /* ── Footer card ── */
  .footer-card {
    border: 2px solid #ddd6fe; border-radius: 18px;
    padding: 14px 20px; background: white;
    display: flex; align-items: center; gap: 14px;
  }
  .footer-emoji { font-size: 38px; flex-shrink: 0; }
  .footer-title { font-size: 13px; font-weight: 800; color: #1a1a2e; }
  .footer-body { font-size: 9.5px; color: #475569; line-height: 1.5; margin-top: 3px; }

  /* ── Page footer ── */
  .page-footer { text-align: center; padding: 10px; font-size: 8px; color: #cbd5e1; }
</style>
</head>
<body>

<!-- Page header -->
<div class="page-header">
  <img class="logo" src="${logoSrc}" alt="Busy Brains" />
  <div class="page-title">Busy Brains Child's Workbook</div>
</div>

<div class="content" style="padding-left:12px; padding-right:12px;">

  <!-- ── Main toolkit card ── -->
  <div class="card">
    <div class="card-hero">
      <div>
        <div class="hero-badge">&#10024; Final Toolkit</div>
        <div class="hero-title">
          <span class="child-name">${this.escapeHtml(childName)}'s</span>
          Busy Brains Complete Toolkit &#127827;
        </div>
        <div class="hero-subtitle">Built from your favourites, quiz results &amp; sensory profile</div>
      </div>
      <img class="hero-img" src="${heroSrc}" alt="Child meditating" />
    </div>

    <!-- Brain Type + Tactile Sense -->
    <div class="two-col">
      <div class="col-cell">
        <div class="cell-header">
          <img class="cell-icon" src="${brainIconSrc}" alt="Brain" />
          <div>
            <div class="cell-label">My Brain Type</div>
            <div class="cell-sublabel">${this.escapeHtml(brainType.subtitle)}</div>
          </div>
        </div>
        <div class="cell-title">${this.escapeHtml(brainType.title)}</div>
        <div class="cell-body">${this.escapeHtml(brainType.description)}</div>
      </div>
      <div class="col-cell">
        <div class="cell-header">
          <img class="cell-icon" src="${tactileIconSrc}" alt="Tactile" />
          <div>
            <div class="cell-label">My Tactile Sense</div>
            <div class="cell-sublabel">${this.escapeHtml(tactileSense.subtitle)}</div>
          </div>
        </div>
        <div class="cell-title">${this.escapeHtml(tactileSense.title)}</div>
        <ul class="bullet-list">${bulletPoints}</ul>
      </div>
    </div>
  </div>

  <!-- ── Fun Tools + My Toolkit ── -->
  <div class="card">
    <div class="two-col">
      <div class="col-cell green-bg">
        <div class="cell-header">
          <img class="cell-icon" src="${toolsIconSrc}" alt="Tools" />
          <div>
            <div class="cell-label">My Favourite Fun Tools</div>
            <div class="cell-sublabel">${this.escapeHtml(favouriteTools.subtitle)}</div>
          </div>
        </div>
        <div class="tools-section-title">You chose these as YOUR all-time faves</div>
        <div class="tag-wrap">${toolTags}</div>
      </div>
      <div class="col-cell purple-bg">
        <div class="cell-header">
          <img class="cell-icon" src="${toolkitIconSrc}" alt="Toolkit" />
          <div>
            <div class="cell-label">My Toolkit</div>
            <div class="cell-sublabel">Your body uses different tools at different times</div>
          </div>
        </div>
        <div class="cell-title">${this.escapeHtml(toolkitInfo.title)}</div>
        <div class="cell-body">${this.escapeHtml(toolkitInfo.description)}</div>
        <div class="needs-title">Your body might need:</div>
        <div>${needTags}</div>
      </div>
    </div>
  </div>

  <!-- ── Final Toolkit images ── -->
  <div class="final-card">
    <div class="final-header">
      <div class="final-icon">&#127827;</div>
      <div>
        <div class="final-title">Final Toolkit</div>
        <div class="final-subtitle">From Screen 5 Quiz Result: how well you know your tools</div>
      </div>
    </div>
    <div class="toolkit-row">
      <span class="toolkit-name">${this.escapeHtml(toolkitInfo.title)}</span>
      <span class="primary-badge">Primary Tool</span>
    </div>
    <div class="img-grid">${imageGrid}</div>
  </div>

  <!-- ── Footer card ── -->
  <div class="footer-card">
    <div class="footer-emoji">&#129504;&#10024;</div>
    <div>
      <div class="footer-title">You're a Busy Brain Superstar! &#128100; &#10024;</div>
      <div class="footer-body">
        You now know your brain type, your sensory profile, AND your personal toolkit.
        Stick this on your fridge! Whenever you feel big feelings, look at your toolkit
        and pick a tool. You've totally got this! &#128153;
      </div>
    </div>
  </div>

</div>

<div class="page-footer">
  Busy Brain Institute &middot; Busy Brains Child's Workbook &middot; My Personal Guide
</div>

</body>
</html>`;
  }
}
