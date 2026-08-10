import { readFileSync } from "fs";
import { join } from "path";
import {
  BrainFlag,
  FavouriteTool,
  GridImage,
  ImageGroup,
  ReportModel,
  TactileFlag,
  ToolkitFlag,
} from "../modules/toolkit-report/toolkit-report.types";
import {
  BRAIN_CONTENT,
  FAVOURITE_TOOL_IMAGES,
  IMAGE_SETS,
  TACTILE_CONTENT,
  TOOLKIT_CONTENT,
  TOOLKIT_IMAGE_GROUPS,
} from "../modules/toolkit-report/toolkit-report.constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SavedToolkitGroup {
  list?: { title?: string }[];
  toolFlag?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Dashed border accent per tool category for the Final Toolkit grid tiles.
const GROUP_ACCENT: Record<ImageGroup, string> = {
  movement: "#EF8570",
  rest_and_breathe: "#A176FD",
  calm_and_comfort: "#6CC5C6",
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
  hand: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"><g clip-path="url(#clip0_9450_228208)"><path d="M18 11V6C18 5.46957 17.7893 4.96086 17.4142 4.58579C17.0391 4.21071 16.5304 4 16 4C15.4696 4 14.9609 4.21071 14.5858 4.58579C14.2107 4.96086 14 5.46957 14 6" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 9.99951V3.99951C14 3.46908 13.7893 2.96037 13.4142 2.5853C13.0391 2.21023 12.5304 1.99951 12 1.99951C11.4696 1.99951 10.9609 2.21023 10.5858 2.5853C10.2107 2.96037 10 3.46908 10 3.99951V5.99951" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M9.99609 10.5V6C9.99609 5.46957 9.78538 4.96086 9.41031 4.58579C9.03523 4.21071 8.52653 4 7.99609 4C7.46566 4 6.95695 4.21071 6.58188 4.58579C6.20681 4.96086 5.99609 5.46957 5.99609 6V14" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M17.9962 7.99902C17.9962 7.46859 18.2069 6.95988 18.582 6.58481C18.9571 6.20974 19.4658 5.99902 19.9962 5.99902C20.5266 5.99902 21.0353 6.20974 21.4104 6.58481C21.7855 6.95988 21.9962 7.46859 21.9962 7.99902V13.999C21.9962 16.1208 21.1533 18.1556 19.653 19.6559C18.1528 21.1562 16.1179 21.999 13.9962 21.999H11.9962C9.19619 21.999 7.49619 21.139 6.0062 19.659L2.4062 16.059C2.06213 15.678 1.87778 15.1792 1.89132 14.666C1.90486 14.1527 2.11524 13.6644 2.47892 13.302C2.84259 12.9396 3.3317 12.7309 3.84497 12.7192C4.35824 12.7075 4.85636 12.8936 5.2362 13.239L6.99619 14.999" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></g><defs><clipPath id="clip0_9450_228208"><rect width="24" height="24" fill="white"/></clipPath></defs></svg>`,
  star: `<span class="emoji">⭐</span>`,
  target: `<span class="emoji">🎯</span>`,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function loadAsset(assetsDir: string, relativePath: string): string {
  const fullPath = join(assetsDir, relativePath);
  const ext = relativePath.split(".").pop();
  const mime = ext === "svg" ? "image/svg+xml" : `image/${ext}`;
  const data = readFileSync(fullPath).toString("base64");
  return `data:${mime};base64,${data}`;
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}

/** Letters with the highest (non-zero) count; [] when nothing answered. */
function winningFlags(counts: Record<string, number> | undefined): string[] {
  const entries = Object.entries(counts ?? {}).filter(([, c]) => c > 0);
  if (entries.length === 0) return [];
  const max = Math.max(...entries.map(([, c]) => c));
  return entries
    .filter(([, c]) => c === max)
    .map(([letter]) => letter)
    .sort();
}

/** Drop placeholder "unknown" type strings produced when a quiz is unstarted. */
function cleanType(type: string | undefined): string | undefined {
  if (!type || type.toLowerCase() === "unknown") return undefined;
  return type;
}

// ---------------------------------------------------------------------------
// Model builders (pure functions, no DB dependencies)
// ---------------------------------------------------------------------------

export interface DashboardData {
  brain_data?: {
    status?: string;
    type?: string;
    counts?: Record<string, number>;
  };
  tactile_data?: {
    status?: string;
    type?: string;
    counts?: Record<string, number>;
  };
  favourite_tools_data?: {
    status?: string;
    data?: Record<string, unknown> | null;
  };
  final_toolkit_data?: {
    status?: string;
    data?: Record<string, unknown> | null;
  };
}

export interface BuildHtmlOptions {
  /** Absolute path to the assets directory (contains logo.svg, hero-child.svg, images/). */
  assetsDir: string;
  /** Child's display name. */
  childName: string;
  /** Dashboard payload (same shape as DashboardService.getDashboard returns). */
  dashboard: DashboardData;
}

function resolveBrainType(brain: {
  type?: string;
  counts?: Record<string, number>;
}): ReportModel["brainType"] {
  const winners = winningFlags(brain.counts);
  const flag: BrainFlag =
    winners.length === 1 ? (winners[0] as BrainFlag) : "MIX";
  const content = BRAIN_CONTENT[flag] ?? BRAIN_CONTENT.MIX;
  return {
    title: cleanType(brain.type) ?? "Still discovering your brain type",
    subtitle: content.subtitle,
    description: content.description,
  };
}

function resolveTactileSense(tactile: {
  type?: string;
  counts?: Record<string, number>;
}): ReportModel["tactileSense"] {
  const winners = winningFlags(tactile.counts);
  const single = winners.length === 1;
  const flag: TactileFlag = single ? (winners[0] as TactileFlag) : "MIX";

  const bulletPoints = single
    ? TACTILE_CONTENT[flag].bulletPoints
    : winners.length > 1
      ? dedupe(
          winners.flatMap(
            (w) => TACTILE_CONTENT[w as TactileFlag]?.bulletPoints ?? [],
          ),
        )
      : TACTILE_CONTENT.MIX.bulletPoints;

  return {
    title: cleanType(tactile.type) ?? "Still discovering your tactile sense",
    subtitle: (TACTILE_CONTENT[flag] ?? TACTILE_CONTENT.MIX).subtitle,
    bulletPoints,
  };
}

function resolveFavouriteTools(
  data: Record<string, unknown> | null | undefined,
): ReportModel["favouriteTools"] {
  const groups =
    (data?.module_5_quest_2_saved_toolkit as SavedToolkitGroup[]) ?? [];
  const seen = new Set<string>();
  const tools: FavouriteTool[] = [];
  for (const group of groups) {
    for (const item of group.list ?? []) {
      const title = item.title?.trim();
      if (!title || seen.has(title)) continue;
      seen.add(title);
      tools.push({
        title,
        flag: group.toolFlag ?? "",
        imageFile: FAVOURITE_TOOL_IMAGES[title] ?? "",
      });
    }
  }
  return {
    subtitle: "You picked these yourself — great taste!",
    tools,
  };
}

function resolveToolkit(data: Record<string, unknown> | null | undefined): {
  toolkitInfo: ReportModel["toolkitInfo"];
  images: GridImage[];
} {
  const counts = (data?.module_5_quest_3_screen_2_quiz_counts ?? {}) as Record<
    string,
    number
  >;
  const winners = winningFlags(counts);
  const single = winners.length === 1;
  const flag: ToolkitFlag = single ? (winners[0] as ToolkitFlag) : "MIX";
  const content = TOOLKIT_CONTENT[flag] ?? TOOLKIT_CONTENT.MIX;

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

export function buildReportModel(
  childName: string,
  dashboard: DashboardData,
): ReportModel {
  const brain = dashboard.brain_data ?? {};
  const tactile = dashboard.tactile_data ?? {};
  const favouriteToolsData = dashboard.favourite_tools_data ?? {};
  const finalToolkitData = dashboard.final_toolkit_data ?? {};

  return {
    childName,
    brainType: resolveBrainType(brain),
    tactileSense: resolveTactileSense(tactile),
    favouriteTools: resolveFavouriteTools(favouriteToolsData.data),
    ...resolveToolkit(finalToolkitData.data),
  };
}

// ---------------------------------------------------------------------------
// HTML builder
// ---------------------------------------------------------------------------

function buildImageGrid(assetsDir: string, images: GridImage[]): string {
  return images
    .map((img) => {
      const src = loadAsset(assetsDir, `images/${img.imageFile}`);
      const accent = GROUP_ACCENT[img.group];
      return `
          <div class="border-[1.5px] border-dashed rounded-[14px] px-1.5 pt-2.5 pb-[9px] flex flex-col items-center bg-white" style="border-color:${accent}">
            <img class="w-full h-20 object-contain mb-[7px]" src="${src}" alt="${escapeHtml(img.label)}" />
            <div class="text-[8px] font-bold text-[#334155] text-center leading-[1.3]">${escapeHtml(img.label)}</div>
          </div>`;
    })
    .join("");
}

function buildFavouriteToolsGrid(
  assetsDir: string,
  tools: FavouriteTool[],
): string {
  return tools
    .map((tool) => {
      const accent = (TAG_COLORS[tool.flag] ?? DEFAULT_TAG).border;
      const img = tool.imageFile
        ? loadAsset(assetsDir, `images/${tool.imageFile}`)
        : null;
      const imageEl = img
        ? `<img class="w-full h-20 object-contain mb-[7px]" src="${img}" alt="${escapeHtml(tool.title)}" />`
        : `<div class="w-full h-20 mb-[7px]"></div>`;
      return `
          <div class="border-[1.5px] border-dashed rounded-[14px] px-1.5 pt-2.5 pb-[9px] flex flex-col items-center bg-white" style="border-color:${accent}">
            ${imageEl}
            <div class="text-[8px] font-bold text-[#334155] text-center leading-[1.3]">${escapeHtml(tool.title)}</div>
          </div>`;
    })
    .join("");
}

export function buildToolkitReportHtml(options: BuildHtmlOptions): string {
  const { assetsDir, childName, dashboard } = options;

  const model = buildReportModel(childName, dashboard);
  const { brainType, tactileSense, favouriteTools, toolkitInfo } = model;

  const logoSrc = loadAsset(assetsDir, "logo.svg");
  const heroSrc = loadAsset(assetsDir, "hero-child.svg");

  const favouriteToolsGrid = buildFavouriteToolsGrid(
    assetsDir,
    favouriteTools.tools,
  );

  const bulletPoints = tactileSense.bulletPoints
    .map(
      (p) =>
        `<li class="text-[10.5px] text-[#475569] leading-[1.55] pl-3.5 relative mb-0.5 before:content-['•'] before:absolute before:left-0.5 before:text-[#94a3b8] before:font-bold">${escapeHtml(p)}</li>`,
    )
    .join("");

  const imageGrid = buildImageGrid(assetsDir, model.images);

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
          'bb-slate': '#2F5064',
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
          'bb-purple': '#9C6AFF',
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
    box-sizing: border-box;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .emoji { font-family: "Noto Color Emoji", sans-serif; }
</style>
</head>
<body>
<div class="pb-7">

  <!-- Top bar -->
  <div class="flex justify-center items-center pt-3 pb-3">
      <img class="h-20 block" src="${logoSrc}" alt="Busy Brains" />
  </div>

  <div class="max-w-[700px] mx-auto mt-[18px] mb-0 px-[18px] flex flex-col gap-3.5">

    <!-- Hero -->
    <div class="relative overflow-clip rounded-3xl border-[2px] border-[#89D1D1] bg-[linear-gradient(0deg,rgba(255,255,255,0.20)_0%,rgba(255,255,255,0.20)_100%),linear-gradient(135deg,rgba(108,197,198,0.18)_0%,rgba(156,106,255,0.12)_60%,rgba(255,213,37,0.10)_100%)] px-6 py-5 flex justify-between items-center relative overflow-hidden">
      
      <div class="absolute -top-[40px] right-[80px] w-[120px] h-[120px] rounded-full bg-[#9C6AFF10]"></div>
      <div class="absolute -bottom-[50px] left-[30px] w-[80px] h-[80px] rounded-full bg-[#6CC5C610]"></div>

      <div>
        <span class="inline-flex items-center gap-1.5 border border-[rgba(108,197,198,0.4)] bg-[rgba(108,197,198,0.18)] text-[#34586E] text-[9px] font-semibold px-2.5 py-[3px] rounded-[20px] mb-2.5">
          <span class="w-1.5 h-1.5 rounded-full bg-[#6CC5C6]"></span> Final Toolkit
        </span>
        <div class="text-[23px] font-black text-bb-slate leading-[1.2] tracking-[-0.4px]">
          ${escapeHtml(childName)}'s Busy Brains <span class="text-bb-teal">Complete Toolkit</span> &#127890;
        </div>
        <div class="text-[10.5px] text-bb-slate-muted mt-[7px]">Built from your favourites, quiz results &amp; sensory profile</div>
      </div>
      <img class="w-24 h-24 object-contain shrink-0" src="${heroSrc}" alt="Child meditating" />
    </div>

    <!-- Brain Type + Tactile Sense -->
    <div class="grid grid-cols-2 gap-3.5">
      <div class="border-[2px] border-[#FFD525] rounded-[18px] bg-white">
        <div class="flex items-center gap-[11px] bg-[#FFF8D6] rounded-t-[16px] p-4 pb-6">
          <div class="relative w-[42px] h-[42px] rounded-[18px] flex items-center justify-center shrink-0 bg-bb-yellow">
            ${ICONS.sprout}
            <span class="absolute -bottom-[5px] -right-[5px] w-[17px] h-[17px] rounded-full bg-[#7A5800] border-2 border-white text-white text-[8px] font-extrabold flex items-center justify-center">A</span>
          </div>
          <div>
            <div class="text-[13px] font-extrabold text-[#7A5800]">My Brain Type</div>
            <div class="text-[9.5px] text-[#7A5800] mt-0.5">${escapeHtml(brainHeadSub)}</div>
          </div>
        </div>
        <div class="p-4">
          <div class="text-sm font-extrabold text-bb-slate mb-[7px]">${escapeHtml(brainType.title)}</div>
          <p class="text-[10.5px] text-bb-slate-light leading-[1.6]">${escapeHtml(brainType.description)}</p>
        </div>
      </div>

      <div class="border-[2px] border-[#2CC3D5] rounded-[18px] bg-white">
        <div class="flex items-center gap-[11px] bg-bb-teal-bg rounded-t-[18px] p-4">
          <div class="relative w-[42px] h-[42px] rounded-[18px] flex items-center justify-center shrink-0 bg-bb-teal-light">
            ${ICONS.hand}
            <span class="absolute -bottom-[5px] -right-[5px] w-[17px] h-[17px] rounded-full bg-[#2D5353] border-2 border-white text-white text-[8px] font-extrabold flex items-center justify-center">B</span>
          </div>
          <div>
            <div class="text-[13px] font-extrabold text-[#2D5353]">My Tactile Sense</div>
            <div class="text-[9.5px] text-[#2D5353] mt-0.5">${escapeHtml(tactileHeadSub)}</div>
          </div>
        </div>
        <div class="p-4">
          <div class="text-sm font-extrabold text-bb-slate mb-[7px]">${escapeHtml(tactileSense.title)}</div>
          <ul class="list-none p-0">${bulletPoints}</ul>
        </div>
      </div>
    </div>

    <!-- Favourite Fun Tools -->
    <div class="border-[2px] border-[#C4EEB2] rounded-[18px]">
      <div class="flex items-center gap-[11px] p-4 rounded-t-[18px] bg-bb-green-bg">
        <div class="relative w-[42px] h-[42px] rounded-[13px] flex items-center justify-center shrink-0 bg-bb-green">
          ${ICONS.star}
          <span class="absolute -bottom-[5px] -right-[5px] w-[17px] h-[17px] rounded-full bg-[#457730] border-2 border-white text-white text-[8px] font-extrabold flex items-center justify-center">C</span>
        </div>
        <div>
          <div class="text-[13px] font-extrabold text-[#457730]">My Favourite Fun Tools</div>
          <div class="text-[9.5px] text-[#457730] mt-0.5">${escapeHtml(favouriteTools.subtitle)}</div>
        </div>
      </div>
      <div class="p-4">
        <div class="text-[12.5px] font-extrabold text-bb-slate mb-[11px]">You chose these as YOUR all-time faves</div>
        <div class="grid grid-cols-5 gap-[11px]">${favouriteToolsGrid}</div>
      </div>
    </div>

    <!-- Final Toolkit -->
    <div class="border-[2px] border-[#9C6AFF] rounded-[20px] p-5">
      <div class="flex items-center gap-[11px] mb-3">
        <div class="relative w-[42px] h-[42px] rounded-[13px] flex items-center justify-center shrink-0 bg-[linear-gradient(135deg,_rgba(156,106,255,0.13)_0%,_rgba(156,106,255,0.27)_100%)]">
          ${ICONS.target}
        </div>
        <div>
          <div class="text-base font-black text-bb-purple">Final Toolkit</div>
          <div class="text-[9.5px] text-bb-slate-faint mt-0.5">From Screen 5 Quiz Result &middot; how well you know your tools</div>
        </div>
      </div>
      <div class="flex items-center gap-[9px] my-1 mb-3.5">
        <span class="text-[13px] font-extrabold text-bb-slate">${escapeHtml(toolkitInfo.title)}</span>
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
    <div class="flex justify-between items-center mt-10 pt-3 border-t border-dashed border-[#6CC5C640] text-[8.5px] text-bb-slate-ghost">
      <span>www.busy-brains.com.au</span>
      <span class="inline-flex gap-1">
        <i class="w-1.5 h-1.5 rounded-full inline-block bg-[#9C6AFF]"></i>
        <i class="w-1.5 h-1.5 rounded-full inline-block bg-[#F77F6A]"></i>
        <i class="w-1.5 h-1.5 rounded-full inline-block bg-[#FFD93B]"></i>
        <i class="w-1.5 h-1.5 rounded-full inline-block bg-[#6CC5C6]"></i>
      </span>
    </div>

  </div>
</div>
</body>
</html>`;
}
