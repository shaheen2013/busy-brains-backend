import { readFileSync } from "fs";
import { join } from "path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BuildCertificateHtmlOptions {
  /** Absolute path to the assets directory (contains logo.svg, buddy.svg, icons/). */
  assetsDir: string;
  /** Child's display name. */
  childName: string;
  /** When the child completed the final quest screen (Module 6, Quest 4, Screen 1). */
  completedAt: Date;
}

// ---------------------------------------------------------------------------
// Static content — fixed per your product decision; only name/date are dynamic.
// ---------------------------------------------------------------------------

const SKILLS = [
  { icon: "skill-notice-body.svg", label: "Notice what your body needs" },
  { icon: "skill-thinking-brain.svg", label: "Use your Thinking Brain" },
  { icon: "skill-tools.svg", label: "Try tools that help your body and brain" },
  { icon: "skill-keep-exploring.svg", label: "Keep exploring and noticing" },
];

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

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// HTML builder
// ---------------------------------------------------------------------------

export function buildCertificateHtml(
  options: BuildCertificateHtmlOptions,
): string {
  const { assetsDir, childName, completedAt } = options;

  const logoSrc = loadAsset(assetsDir, "logo.svg");
  const buddySrc = loadAsset(assetsDir, "buddy.svg");
  const brainCornerSrc = loadAsset(assetsDir, "icons/corner-brain.svg");
  const sunCornerSrc = loadAsset(assetsDir, "icons/corner-sun.svg");
  const heartCornerSrc = loadAsset(assetsDir, "icons/corner-heart.svg");
  const asteriskCornerSrc = loadAsset(assetsDir, "icons/corner-asterisk.svg");

  const skillCards = SKILLS.map((skill) => {
    const iconSrc = loadAsset(assetsDir, `icons/${skill.icon}`);
    return `
        <div class="flex items-center gap-2.5 border border-[#E2E8F0] rounded-[12px] px-3.5 py-3 bg-white">
          <img class="w-6 h-6" src="${iconSrc}" alt="" />
          <span class="text-[13px] font-semibold text-[#2F5064]">${escapeHtml(skill.label)}</span>
        </div>`;
  }).join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&family=Nunito+Sans:wght@400;500;600;700;800;900&family=Dancing+Script:wght@600;700&display=swap" rel="stylesheet">

<script src="https://cdn.tailwindcss.com"></script>
<script>
  tailwind.config = {
    theme: {
      extend: {
        fontFamily: {
          nunito: ['"Nunito"', 'sans-serif'],
          script: ['"Dancing Script"', 'cursive'],
        },
        colors: {
          'bb-slate': '#2F5064',
          'bb-purple': '#9C6AFF',
          'bb-teal': '#22b8c9',
        },
      },
    },
  }
</script>

<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: "Nunito", sans-serif;
    background: #ffffff;
    color: #1e293b;
    font-size: 13px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
</style>
</head>
<body>
<div class="relative overflow-hidden rounded-[32px] border-[2px] border-transparent m-6" style="background: linear-gradient(135deg, #d9f7f8 0%, #eee7ff 50%, #fff8d6 100%); padding: 2px;">
  <div class="relative bg-white rounded-[30px] px-16 py-14 overflow-hidden">

    <img class="absolute top-8 left-8 w-16 h-16" src="${brainCornerSrc}" alt="" />
    <img class="absolute top-8 right-8 w-16 h-16" src="${sunCornerSrc}" alt="" />
    <img class="absolute bottom-8 left-8 w-16 h-16" src="${heartCornerSrc}" alt="" />
    <img class="absolute top-1/2 left-6 w-14 h-14" src="${asteriskCornerSrc}" alt="" />

    <div class="flex flex-col items-center text-center">
      <img class="h-14 mb-6" src="${logoSrc}" alt="Busy Brains" />

      <div class="flex items-center gap-3 mb-2">
        <span class="text-2xl">〜</span>
        <h1 class="text-[40px] font-black text-bb-purple tracking-[-0.5px]">Brain Boss Certificate</h1>
        <span class="text-2xl">〜</span>
      </div>

      <p class="text-[15px] text-slate-500 mt-3">is proudly presented to</p>

      <div class="mt-2 mb-3">
        <div class="font-script text-[52px] text-bb-purple leading-none">${escapeHtml(childName)}</div>
        <div class="w-72 border-b border-[#cbd5e1] mx-auto mt-2"></div>
      </div>

      <p class="text-[15px] text-slate-500 mt-3">for completing the</p>
      <p class="text-[19px] font-extrabold text-bb-teal mb-6">Busy Brains adventure!</p>

      <p class="text-[13px] font-semibold text-slate-600 mb-3">As a Busy Brains Boss you can:</p>
      <div class="grid grid-cols-2 gap-3 w-full max-w-[560px] mb-8">
        ${skillCards}
      </div>

      <div class="flex items-end justify-between w-full mt-2">
        <div class="text-left">
          <div class="font-script text-[26px] text-bb-slate leading-none">Aileen Mathyssen</div>
          <div class="w-44 border-b border-[#cbd5e1] mt-2 mb-2"></div>
          <div class="text-[11px] text-slate-500">Occupational Therapist</div>
          <div class="text-[11px] text-slate-500">Busy Brains Creator</div>
          <div class="text-[11px] text-slate-400 mt-3">Adventure Completed</div>
          <div class="text-[14px] font-bold text-bb-slate">${escapeHtml(formatDate(completedAt))}</div>
        </div>

        <div class="flex flex-col items-center">
          <img class="w-28 h-28 object-contain" src="${buddySrc}" alt="Buddy" />
          <p class="text-[12px] font-semibold text-slate-600 mt-1">I'm so proud of you! 💗</p>
          <p class="text-[11px] text-slate-400">— Buddy</p>
        </div>
      </div>
    </div>
  </div>
</div>
</body>
</html>`;
}
