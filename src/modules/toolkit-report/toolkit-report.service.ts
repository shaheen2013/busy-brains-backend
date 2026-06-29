import { ForbiddenException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { readFileSync } from "fs";
import { join } from "path";
import puppeteer from "puppeteer";
import { Child } from "../children/entities/child.entity";
import { DashboardService } from "../dashboard/dashboard.service";
import {
  BrainFlag,
  FavouriteTool,
  GridImage,
  ImageGroup,
  ReportModel,
  TactileFlag,
  ToolkitFlag,
} from "./toolkit-report.types";
import {
  BRAIN_CONTENT,
  IMAGE_SETS,
  TACTILE_CONTENT,
  TOOLKIT_CONTENT,
  TOOLKIT_IMAGE_GROUPS,
} from "./toolkit-report.constants";

interface SavedToolkitGroup {
  list?: { title?: string }[];
  toolFlag?: string;
}

// Dashed border accent per tool category for the Final Toolkit grid tiles.
const GROUP_ACCENT: Record<ImageGroup, string> = {
  movement: "#EF8570",
  rest_and_breathe: "#A176FD",
  calm_and_comfort: "#34C0CE",
};

// Favourite-tool tag colours keyed by the saved toolFlag.
const TAG_COLORS: Record<string, { bg: string; border: string; text: string }> =
  {
    movement: { bg: "#F5F3FF", border: "#DDD6FE", text: "#7C3AED" },
    restBreath: { bg: "#ECFEFF", border: "#A5E8EC", text: "#0E9CA8" },
    fun: { bg: "#FFF1ED", border: "#FBD3C8", text: "#E8694B" },
    calmComfort: { bg: "#F0FDF4", border: "#BBF7D0", text: "#16A34A" },
  };

const DEFAULT_TAG = { bg: "#F1F5F9", border: "#E2E8F0", text: "#475569" };

// Inline glyphs for the section icons (the brand asset icons don't match the
// design, so the report draws its own simple line icons).
const ICONS = {
  sprout: `<span class="emoji">🧩</span>`,
  hand: '<svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.5 12V6.5a1.5 1.5 0 0 1 3 0V11"/><path d="M10.5 11V4.8a1.5 1.5 0 0 1 3 0V11"/><path d="M13.5 11.2V6.2a1.5 1.5 0 0 1 3 0V13"/><path d="M16.5 10.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1.6a6 6 0 0 1-4.9-2.6l-2.4-3.5a1.5 1.5 0 0 1 2.4-1.8L8.4 15"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="#ffffff" stroke="#ffffff" stroke-width="1.2" stroke-linejoin="round"><polygon points="12 3 14.6 9.1 21 9.6 16.1 13.9 17.7 20.2 12 16.6 6.3 20.2 7.9 13.9 3 9.6 9.4 9.1"/></svg>',
  target: `<span class="emoji">🎯</span>`,
};

@Injectable()
export class ToolkitReportService {
  constructor(
    private readonly dashboardService: DashboardService,
    @InjectRepository(Child)
    private readonly childRepository: Repository<Child>,
  ) {}

  async generatePdf(userId: string, childId: string): Promise<Buffer> {
    const model = await this.buildReportModel(userId, childId);
    const html = this.buildHtml(model);

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

  // -------------------------------------------------------------------------
  // Build the report model from the child's real progress data.
  // -------------------------------------------------------------------------
  private async buildReportModel(
    userId: string,
    childId: string,
  ): Promise<ReportModel> {
    const child = await this.childRepository.findOne({
      where: { id: childId, userId },
    });
    if (!child) throw new ForbiddenException("Child not found");

    const dashboard = await this.dashboardService.getDashboard(
      userId,
      childId,
      [],
    );

    const brain = (dashboard.brain_data ?? {}) as {
      type?: string;
      counts?: Record<string, number>;
    };
    const tactile = (dashboard.tactile_data ?? {}) as {
      type?: string;
      counts?: Record<string, number>;
    };
    const favouriteToolsData = (dashboard.favourite_tools_data ?? {}) as {
      data?: Record<string, unknown> | null;
    };
    const finalToolkitData = (dashboard.final_toolkit_data ?? {}) as {
      data?: Record<string, unknown> | null;
    };

    return {
      childName: child.name,
      brainType: this.resolveBrainType(brain),
      tactileSense: this.resolveTactileSense(tactile),
      favouriteTools: this.resolveFavouriteTools(favouriteToolsData.data),
      ...this.resolveToolkit(finalToolkitData.data),
    };
  }

  /** Letters with the highest (non-zero) count; [] when nothing answered. */
  private winningFlags(counts: Record<string, number> | undefined): string[] {
    const entries = Object.entries(counts ?? {}).filter(([, c]) => c > 0);
    if (entries.length === 0) return [];
    const max = Math.max(...entries.map(([, c]) => c));
    return entries
      .filter(([, c]) => c === max)
      .map(([letter]) => letter)
      .sort();
  }

  private resolveBrainType(brain: {
    type?: string;
    counts?: Record<string, number>;
  }): ReportModel["brainType"] {
    const winners = this.winningFlags(brain.counts);
    const flag: BrainFlag =
      winners.length === 1 ? (winners[0] as BrainFlag) : "MIX";
    const content = BRAIN_CONTENT[flag] ?? BRAIN_CONTENT.MIX;
    return {
      title: this.cleanType(brain.type) ?? "Still discovering your brain type",
      subtitle: content.subtitle,
      description: content.description,
    };
  }

  private resolveTactileSense(tactile: {
    type?: string;
    counts?: Record<string, number>;
  }): ReportModel["tactileSense"] {
    const winners = this.winningFlags(tactile.counts);
    const single = winners.length === 1;
    const flag: TactileFlag = single ? (winners[0] as TactileFlag) : "MIX";

    const bulletPoints = single
      ? TACTILE_CONTENT[flag].bulletPoints
      : winners.length > 1
        ? this.dedupe(
            winners.flatMap(
              (w) => TACTILE_CONTENT[w as TactileFlag]?.bulletPoints ?? [],
            ),
          )
        : TACTILE_CONTENT.MIX.bulletPoints;

    return {
      title:
        this.cleanType(tactile.type) ?? "Still discovering your tactile sense",
      subtitle: (TACTILE_CONTENT[flag] ?? TACTILE_CONTENT.MIX).subtitle,
      bulletPoints,
    };
  }

  private resolveFavouriteTools(
    data: Record<string, unknown> | null | undefined,
  ): ReportModel["favouriteTools"] {
    const groups =
      (data?.module_5_quest_1_saved_toolkit as SavedToolkitGroup[]) ?? [];
    const seen = new Set<string>();
    const tools: FavouriteTool[] = [];
    for (const group of groups) {
      for (const item of group.list ?? []) {
        const title = item.title?.trim();
        if (!title || seen.has(title)) continue;
        seen.add(title);
        tools.push({ title, flag: group.toolFlag ?? "" });
      }
    }
    return {
      subtitle: "You picked these yourself — great taste!",
      tools,
    };
  }

  private resolveToolkit(data: Record<string, unknown> | null | undefined): {
    toolkitInfo: ReportModel["toolkitInfo"];
    images: GridImage[];
  } {
    const counts = (data?.module_5_quest_3_screen_2_quiz_counts ??
      {}) as Record<string, number>;
    const winners = this.winningFlags(counts);
    const single = winners.length === 1;
    const flag: ToolkitFlag = single ? (winners[0] as ToolkitFlag) : "MIX";
    const content = TOOLKIT_CONTENT[flag] ?? TOOLKIT_CONTENT.MIX;

    // Single winner -> that category's images. Tie -> the tied categories'
    // images combined. No answers -> the balanced fallback set.
    let groups: ImageGroup[];
    if (single) {
      groups = TOOLKIT_IMAGE_GROUPS[flag];
    } else if (winners.length > 1) {
      const seen = new Set<ImageGroup>();
      groups = [];
      for (const w of winners) {
        for (const g of TOOLKIT_IMAGE_GROUPS[w as ToolkitFlag] ?? []) {
          if (!seen.has(g)) {
            seen.add(g);
            groups.push(g);
          }
        }
      }
    } else {
      groups = content.imageGroups;
    }

    const images: GridImage[] = groups.flatMap((group) =>
      (IMAGE_SETS[group] ?? []).map((img) => ({
        imageFile: img.imageFile,
        label: img.label,
        group,
      })),
    );

    return {
      toolkitInfo: {
        title: content.title,
        description: content.description,
        needs: content.needs,
      },
      images,
    };
  }

  /** Drop placeholder "unknown" type strings produced when a quiz is unstarted. */
  private cleanType(type: string | undefined): string | undefined {
    if (!type || type.toLowerCase() === "unknown") return undefined;
    return type;
  }

  private dedupe(values: string[]): string[] {
    return [...new Set(values)];
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

  private buildImageGrid(images: GridImage[]): string {
    return images
      .map((img) => {
        const src = this.loadAsset(`images/${img.imageFile}`);
        const accent = GROUP_ACCENT[img.group];
        return `
          <div class="cell" style="border-color:${accent}">
            <img class="cell-img" src="${src}" alt="${this.escapeHtml(img.label)}" />
            <div class="cell-label">${this.escapeHtml(img.label)}</div>
          </div>`;
      })
      .join("");
  }

  private buildHtml(model: ReportModel): string {
    const { childName, brainType, tactileSense, favouriteTools, toolkitInfo } =
      model;

    const logoSrc = this.loadAsset("logo.svg");
    const heroSrc = this.loadAsset("hero-child.svg");

    const toolTags = favouriteTools.tools
      .map((tool) => {
        const c = TAG_COLORS[tool.flag] ?? DEFAULT_TAG;
        return `<span class="tag" style="background:${c.bg};border-color:${c.border};color:${c.text}">${this.escapeHtml(tool.title)}</span>`;
      })
      .join("");

    const bulletPoints = tactileSense.bulletPoints
      .map((p) => `<li>${this.escapeHtml(p)}</li>`)
      .join("");

    const imageGrid = this.buildImageGrid(model.images);

    const brainHeadSub = `${brainType.title} — ${brainType.subtitle}`;
    const tactileHeadSub = `${tactileSense.title} — ${tactileSense.subtitle}`;

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&family=Nunito+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">

<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: "Nunito", "Noto Color Emoji", sans-serif;
    background: #ffffff;
    color: #1e293b;
    font-size: 13px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .emoji { font-family: "Noto Color Emoji", sans-serif;}
  .page { padding-bottom: 28px; }
  .nunito-sans {
    font-family: "Nunito Sans", sans-serif;
  }

  /* ── Top bar ── */
  .topbar { display: flex; justify-content: space-between; align-items: flex-start; }
  .logo-box { padding: 0px; }
  .logo { height: 40px; display: block; }
  .top-title {
    font-size: 22px; font-weight: 800; color: #1e293b;
    padding: 24px 40px 0 0; letter-spacing: -0.3px;
  }

  /* ── Content column ── */
  .wrap {
    max-width: 700px; margin: 18px auto 0; padding: 0 18px;
    display: flex; flex-direction: column; gap: 14px;
  }

  /* ── Hero ── */
  .hero {
    background: linear-gradient(120deg, #ede9fe 0%, #f3eefe 55%, #fdeef6 100%);
    border: 1px solid #ece3fb;
    border-radius: 22px;
    padding: 20px 24px;
    display: flex; justify-content: space-between; align-items: center;
    position: relative; overflow: hidden;
  }
  .hero-badge {
    display: inline-flex; align-items: center; gap: 6px;
    background: #ffffff; border: 1px solid #ece3fb;
    color: #6b7280; font-size: 9px; font-weight: 600;
    padding: 3px 10px; border-radius: 20px; margin-bottom: 10px;
  }
  .hero-badge .dot { width: 6px; height: 6px; border-radius: 50%; background: #22b8c9; }
  .hero-title { font-size: 23px; font-weight: 900; color: #1e293b; line-height: 1.2; letter-spacing: -0.4px; }
  .hero-title .accent { color: #22b8c9; }
  .hero-sub { font-size: 10.5px; color: #64748b; margin-top: 7px; }
  .hero-img { width: 96px; height: 96px; object-fit: contain; flex-shrink: 0; }

  /* ── Section icon squares + letter badge ── */
  .card-head { display: flex; align-items: center; gap: 11px; margin-bottom: 12px; }

  .icon-sq {
    position: relative; width: 42px; height: 42px; border-radius: 13px;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .icon-sq svg { width: 22px; height: 22px; }
  .icon-sq.yellow { background: #fbbf24; }
  .icon-sq.teal { background: #2cc0ce; }
  .icon-sq.green { background: #34c759; }
  .icon-sq.purple { background: linear-gradient(135deg, #a855f7 0%, #ec4899 100%); }
  .icon-sq .badge {
    position: absolute; bottom: -5px; right: -5px;
    width: 17px; height: 17px; border-radius: 50%;
    background: #34c759; border: 2px solid #ffffff;
    color: #ffffff; font-size: 8px; font-weight: 800;
    display: flex; align-items: center; justify-content: center;
  }
  .card-label { font-size: 13px; font-weight: 800; color: #1e293b; }
  .card-sub { font-size: 9.5px; color: #94a3b8; margin-top: 2px; }
  .card-h2 { font-size: 14px; font-weight: 800; color: #1e293b; margin-bottom: 7px; }
  .card-p { font-size: 10.5px; color: #475569; line-height: 1.6; }
  .cards-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .info-card { border: 1px solid #BBE4E5; border-radius: 18px; background: #fff; }
  .info-card.brain { border-color: #FFD52544; }
  .brain .card-head { background: #FFD525; border-radius: 18px 18px 0 0; padding: 16px; }
  .tactile .card-head { background: #F0F9F9; border-radius: 18px 18px 0 0; padding: 16px; }
  .bullets { list-style: none; padding: 0; }
  .bullets li {
    font-size: 10.5px; color: #475569; line-height: 1.55;
    padding-left: 14px; position: relative; margin-bottom: 2px;
  }
  .bullets li::before { content: '•'; position: absolute; left: 2px; color: #94a3b8; font-weight: 700; }

  /* ── Fun tools ── */
  .fun-card { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 18px; padding: 18px; }
  .fun-h2 { font-size: 12.5px; font-weight: 800; color: #1e293b; margin-bottom: 11px; }
  .tags { display: flex; flex-wrap: wrap; gap: 7px; }
  .tag { font-size: 9.5px; font-weight: 600; padding: 5px 12px; border-radius: 20px; border: 1px solid; }

  /* ── Final toolkit ── */
  .final-card { border: 1px solid #6CC5C640; border-radius: 20px; padding: 20px; background: #6CC5C618; }
  .final-label { font-size: 16px; font-weight: 900; color: #7c3aed; }
  .toolkit-row { display: flex; align-items: center; gap: 9px; margin: 4px 0 14px; }
  .toolkit-name { font-size: 13px; font-weight: 800; color: #1e293b; }
  .primary-badge {
    background: #ede7ff; color: #7c3aed;
    font-size: 9px; font-weight: 700; padding: 3px 11px; border-radius: 14px;
  }
  .grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 11px; }
  .cell {
    border: 1.5px dashed; border-radius: 14px;
    padding: 10px 6px 9px;
    display: flex; flex-direction: column; align-items: center;
    background: #ffffff;
  }
  .cell-img { width: 100%; height: 80px; object-fit: contain; margin-bottom: 7px; }
  .cell-label { font-size: 8px; font-weight: 700; color: #334155; text-align: center; line-height: 1.3; }

  /* ── Superstar ── */
  .star-card {
    border: 1px solid #e9d5ff; border-radius: 18px; padding: 16px 20px;
    background: #faf8ff; display: flex; align-items: center; gap: 14px;
  }
  .star-emoji { font-size: 34px; flex-shrink: 0; }
  .star-title { font-size: 14px; font-weight: 800; color: #7c3aed; }
  .star-body { font-size: 10px; color: #475569; line-height: 1.55; margin-top: 4px; }

  /* ── Page footer ── */
  .page-foot {
    display: flex; justify-content: space-between; align-items: center;
    margin-top: 14px; padding-top: 12px; border-top: 1px dashed #e5e7eb;
    font-size: 8.5px; color: #cbd5e1;
  }
  .dots { display: inline-flex; gap: 4px; }
  .dots i { width: 6px; height: 6px; border-radius: 50%; display: inline-block; }
  .dots i:nth-child(1) { background: #f87171; }
  .dots i:nth-child(2) { background: #fbbf24; }
  .dots i:nth-child(3) { background: #34d399; }
  .dots i:nth-child(4) { background: #60a5fa; }
  .dots i:nth-child(5) { background: #a78bfa; }
</style>
</head>
<body>
<div class="page">

  <!-- Top bar -->
  <div class="topbar">
    <div class="logo-box"><img class="logo" src="${logoSrc}" alt="Busy Brains" /></div>
    <div class="top-title">Busy Brains Child's Toolkit</div>
  </div>

  <div class="wrap">

    <!-- Hero -->
    <div class="hero">
      <div>
        <span class="hero-badge"><span class="dot"></span> Final Toolkit</span>
        <div class="hero-title">
          ${this.escapeHtml(childName)}'s Busy Brains <span class="accent">Complete Toolkit</span> &#127890;
        </div>
        <div class="hero-sub">Built from your favourites, quiz results &amp; sensory profile</div>
      </div>
      <img class="hero-img" src="${heroSrc}" alt="Child meditating" />
    </div>

    <!-- Brain Type + Tactile Sense -->
    <div class="cards-2">
      <div class="info-card brain">
        <div class="card-head">
          <div class="icon-sq yellow">${ICONS.sprout}<span class="badge">A</span></div>
          <div>
            <div class="card-label">My Brain Type</div>
            <div class="card-sub">${this.escapeHtml(brainHeadSub)}</div>
          </div>
        </div>
        <div style="padding: 16px;">
          <div class="card-h2">${this.escapeHtml(brainType.title)}</div>
          <p class="card-p">${this.escapeHtml(brainType.description)}</p>
        </div>
      </div>

      <div class="info-card tactile">
        <div class="card-head">
          <div class="icon-sq teal">${ICONS.hand}<span class="badge">B</span></div>
          <div>
            <div class="card-label">My Tactile Sense</div>
            <div class="card-sub">${this.escapeHtml(tactileHeadSub)}</div>
          </div>
        </div>
          <div style="padding: 16px;">
            <div class="card-h2">${this.escapeHtml(tactileSense.title)}</div>
            <ul class="bullets">${bulletPoints}</ul>
          </div>
        </div>
    </div>

    <!-- Favourite Fun Tools -->
    <div class="fun-card">
      <div class="card-head">
        <div class="icon-sq green">${ICONS.star}<span class="badge">C</span></div>
        <div>
          <div class="card-label">My Favourite Fun Tools</div>
          <div class="card-sub">${this.escapeHtml(favouriteTools.subtitle)}</div>
        </div>
      </div>
      <div class="fun-h2">You chose these as YOUR all-time faves</div>
      <div class="tags">${toolTags}</div>
    </div>

    <!-- Final Toolkit -->
    <div class="final-card">
      <div class="card-head">
        <div class="icon-sq purple">${ICONS.target}</div>
        <div>
          <div class="final-label">Final Toolkit</div>
          <div class="card-sub">From Screen 5 Quiz Result &middot; how well you know your tools</div>
        </div>
      </div>
      <div class="toolkit-row">
        <span class="toolkit-name">${this.escapeHtml(toolkitInfo.title)}</span>
        <span class="primary-badge">Primary Tool</span>
      </div>
      <div class="grid">${imageGrid}</div>
    </div>

    <!-- Superstar -->
    <div class="star-card">
      <div class="star-emoji">&#127881;</div>
      <div>
        <div class="star-title">You're a Busy Brain Superstar! &#11088;&#10024;</div>
        <p class="star-body">
          You now know your brain type, your sensory profile, and your personal toolkit.
          Stick this on your fridge or in your bedroom. Whenever you feel big feelings,
          look at your toolkit and pick a tool. You've totally got this!
        </p>
      </div>
    </div>

    <!-- Page footer -->
    <div class="page-foot">
      <span>busy-brains.com.au &middot; Busy Brains Child's Workbook &middot; My Personal Guide</span>
      <span class="dots"><i></i><i></i><i></i><i></i><i></i></span>
    </div>

  </div>
</div>
</body>
</html>`;
  }
}
