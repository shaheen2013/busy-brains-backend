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
          <div class="border-[1.5px] border-dashed rounded-[14px] px-1.5 pt-2.5 pb-[9px] flex flex-col items-center bg-white" style="border-color:${accent}">
            <img class="w-full h-20 object-contain mb-[7px]" src="${src}" alt="${this.escapeHtml(img.label)}" />
            <div class="text-[8px] font-bold text-[#334155] text-center leading-[1.3]">${this.escapeHtml(img.label)}</div>
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
        return `<span class="text-[${c.text}] bg-[${c.bg}] border border-[${c.border}] text-[9.5px] font-semibold px-3 py-[5px] rounded-[20px]">${this.escapeHtml(tool.title)}</span>`;
      })
      .join("");

    const bulletPoints = tactileSense.bulletPoints
      .map(
        (p) =>
          `<li class="text-[10.5px] text-[#475569] leading-[1.55] pl-3.5 relative mb-0.5 before:content-['•'] before:absolute before:left-0.5 before:text-[#94a3b8] before:font-bold">${this.escapeHtml(p)}</li>`,
      )
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

<script src="https://cdn.tailwindcss.com"></script>
<script>
  tailwind.config = {
    theme: {
      extend: {
        fontFamily: {
          nunito: ['"Nunito"', '"Noto Color Emoji"', 'sans-serif'],
          'nunito-sans': ['"Nunito Sans"', 'sans-serif'],
        },
        colors: {
          'bb-slate': '#1e293b',
          'bb-slate-light': '#475569',
          'bb-slate-muted': '#64748b',
          'bb-slate-faint': '#94a3b8',
          'bb-slate-ghost': '#cbd5e1',
          'bb-teal': '#22b8c9',
          'bb-teal-dark': '#0e9ca8',
          'bb-teal-light': '#2cc0ce',
          'bb-teal-bg': '#f0f9f9',
          'bb-teal-border': '#bbe4e5',
          'bb-teal-border-strong': '#6cc5c6',
          'bb-purple': '#7c3aed',
          'bb-purple-light': '#ede7ff',
          'bb-purple-bg': '#faf8ff',
          'bb-purple-border': '#e9d5ff',
          'bb-yellow': '#fbbf24',
          'bb-yellow-bg': '#ffd525',
          'bb-yellow-border': '#ffd52544',
          'bb-green': '#34c759',
          'bb-green-bg': '#f2fbee',
          'bb-green-border': '#bbf7d0',
          'bb-orange': '#e8694b',
          'bb-orange-bg': '#fff1ed',
          'bb-orange-border': '#fbd3c8',
          'bb-cyan': '#34c0ce',
          'bb-cyan-bg': '#ecfeff',
          'bb-cyan-border': '#a5e8ec',
          'bb-violet-bg': '#f5f3ff',
          'bb-violet-border': '#ddd6fe',
          'bb-gray-bg': '#f1f5f9',
          'bb-gray-border': '#e2e8f0',
        },
      },
    },
  }
</script>

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
  .emoji { font-family: "Noto Color Emoji", sans-serif; }
</style>
</head>
<body>
<div class="pb-7">

  <!-- Top bar -->
  <div class="flex justify-between items-start">
    <div class="p-0">
      <img class="h-10 block" src="${logoSrc}" alt="Busy Brains" />
    </div>
    <div class="text-[22px] font-extrabold text-bb-slate pt-6 pr-10 pb-0 pl-0 tracking-[-0.3px]">Busy Brains Child's Toolkit</div>
  </div>

  <div class="max-w-[700px] mx-auto mt-[18px] mb-0 px-[18px] flex flex-col gap-3.5">

    <!-- Hero -->
    <div class="bg-gradient-to-br from-[#ede9fe] via-[#f3eefe] to-[#fdeef6] border border-[#ece3fb] rounded-[22px] px-6 py-5 flex justify-between items-center relative overflow-hidden">
      <div>
        <span class="inline-flex items-center gap-1.5 bg-white border border-[#ece3fb] text-[#6b7280] text-[9px] font-semibold px-2.5 py-[3px] rounded-[20px] mb-2.5">
          <span class="w-1.5 h-1.5 rounded-full bg-bb-teal"></span> Final Toolkit
        </span>
        <div class="text-[23px] font-black text-bb-slate leading-[1.2] tracking-[-0.4px]">
          ${this.escapeHtml(childName)}'s Busy Brains <span class="text-bb-teal">Complete Toolkit</span> &#127890;
        </div>
        <div class="text-[10.5px] text-bb-slate-muted mt-[7px]">Built from your favourites, quiz results &amp; sensory profile</div>
      </div>
      <img class="w-24 h-24 object-contain shrink-0" src="${heroSrc}" alt="Child meditating" />
    </div>

    <!-- Brain Type + Tactile Sense -->
    <div class="grid grid-cols-2 gap-3.5">
      <div class="border border-bb-yellow-border rounded-[18px] bg-white">
        <div class="flex items-center gap-[11px] mb-3 bg-bb-yellow-bg rounded-t-[18px] p-4">
          <div class="relative w-[42px] h-[42px] rounded-[13px] flex items-center justify-center shrink-0 bg-bb-yellow">
            ${ICONS.sprout}
            <span class="absolute -bottom-[5px] -right-[5px] w-[17px] h-[17px] rounded-full bg-bb-green border-2 border-white text-white text-[8px] font-extrabold flex items-center justify-center">A</span>
          </div>
          <div>
            <div class="text-[13px] font-extrabold text-bb-slate">My Brain Type</div>
            <div class="text-[9.5px] text-bb-slate-faint mt-0.5">${this.escapeHtml(brainHeadSub)}</div>
          </div>
        </div>
        <div class="p-4">
          <div class="text-sm font-extrabold text-bb-slate mb-[7px]">${this.escapeHtml(brainType.title)}</div>
          <p class="text-[10.5px] text-bb-slate-light leading-[1.6]">${this.escapeHtml(brainType.description)}</p>
        </div>
      </div>

      <div class="border border-bb-teal-border rounded-[18px] bg-white">
        <div class="flex items-center gap-[11px] mb-3 bg-bb-teal-bg rounded-t-[18px] p-4">
          <div class="relative w-[42px] h-[42px] rounded-[13px] flex items-center justify-center shrink-0 bg-bb-teal-light">
            ${ICONS.hand}
            <span class="absolute -bottom-[5px] -right-[5px] w-[17px] h-[17px] rounded-full bg-bb-green border-2 border-white text-white text-[8px] font-extrabold flex items-center justify-center">B</span>
          </div>
          <div>
            <div class="text-[13px] font-extrabold text-bb-slate">My Tactile Sense</div>
            <div class="text-[9.5px] text-bb-slate-faint mt-0.5">${this.escapeHtml(tactileHeadSub)}</div>
          </div>
        </div>
        <div class="p-4">
          <div class="text-sm font-extrabold text-bb-slate mb-[7px]">${this.escapeHtml(tactileSense.title)}</div>
          <ul class="list-none p-0">${bulletPoints}</ul>
        </div>
      </div>
    </div>

    <!-- Favourite Fun Tools -->
    <div class="border border-bb-green-border rounded-[18px]">
      <div class="flex items-center gap-[11px] p-4 rounded-t-[18px] bg-bb-green-bg">
        <div class="relative w-[42px] h-[42px] rounded-[13px] flex items-center justify-center shrink-0 bg-bb-green">
          ${ICONS.star}
          <span class="absolute -bottom-[5px] -right-[5px] w-[17px] h-[17px] rounded-full bg-bb-green border-2 border-white text-white text-[8px] font-extrabold flex items-center justify-center">C</span>
        </div>
        <div>
          <div class="text-[13px] font-extrabold text-bb-slate">My Favourite Fun Tools</div>
          <div class="text-[9.5px] text-bb-slate-faint mt-0.5">${this.escapeHtml(favouriteTools.subtitle)}</div>
        </div>
      </div>
      <div class="p-4">
        <div class="text-[12.5px] font-extrabold text-bb-slate mb-[11px]">You chose these as YOUR all-time faves</div>
        <div class="flex flex-wrap gap-[7px]">${toolTags}</div>
      </div>
    </div>

    <!-- Final Toolkit -->
    <div class="border border-bb-teal-border-strong/25 rounded-[20px] p-5 bg-bb-teal-border-strong/[0.09]">
      <div class="flex items-center gap-[11px] mb-3">
        <div class="relative w-[42px] h-[42px] rounded-[13px] flex items-center justify-center shrink-0 bg-gradient-to-br from-[#a855f7] to-[#ec4899]">
          ${ICONS.target}
        </div>
        <div>
          <div class="text-base font-black text-bb-purple">Final Toolkit</div>
          <div class="text-[9.5px] text-bb-slate-faint mt-0.5">From Screen 5 Quiz Result &middot; how well you know your tools</div>
        </div>
      </div>
      <div class="flex items-center gap-[9px] my-1 mb-3.5">
        <span class="text-[13px] font-extrabold text-bb-slate">${this.escapeHtml(toolkitInfo.title)}</span>
        <span class="bg-bb-purple-light text-bb-purple text-[9px] font-bold px-[11px] py-[3px] rounded-[14px]">Primary Tool</span>
      </div>
      <div class="grid grid-cols-5 gap-[11px]">${imageGrid}</div>
    </div>

    <!-- Superstar -->
    <div class="border border-bb-purple-border rounded-[18px] px-5 py-4 bg-bb-purple-bg flex items-center gap-3.5">
      <div class="text-[34px] shrink-0">&#127881;</div>
      <div>
        <div class="text-sm font-extrabold text-bb-purple">You're a Busy Brain Superstar! &#11088;&#10024;</div>
        <p class="text-[10px] text-bb-slate-light leading-[1.55] mt-1">
          You now know your brain type, your sensory profile, and your personal toolkit.
          Stick this on your fridge or in your bedroom. Whenever you feel big feelings,
          look at your toolkit and pick a tool. You've totally got this!
        </p>
      </div>
    </div>

    <!-- Page footer -->
    <div class="flex justify-between items-center mt-3.5 pt-3 border-t border-dashed border-[#e5e7eb] text-[8.5px] text-bb-slate-ghost">
      <span>busy-brains.com.au &middot; Busy Brains Child's Workbook &middot; My Personal Guide</span>
      <span class="inline-flex gap-1">
        <i class="w-1.5 h-1.5 rounded-full inline-block bg-red-400"></i>
        <i class="w-1.5 h-1.5 rounded-full inline-block bg-bb-yellow"></i>
        <i class="w-1.5 h-1.5 rounded-full inline-block bg-emerald-400"></i>
        <i class="w-1.5 h-1.5 rounded-full inline-block bg-blue-400"></i>
        <i class="w-1.5 h-1.5 rounded-full inline-block bg-violet-400"></i>
      </span>
    </div>

  </div>
</div>
</body>
</html>`;
  }
}
