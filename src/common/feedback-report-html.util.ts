import { readFileSync } from "fs";
import { join } from "path";

// ---------------------------------------------------------------------------
// Brand palette
// ---------------------------------------------------------------------------

const COLOR_NAVY = "#34586E";
const COLOR_WHITE = "#FFFFFF";
const COLOR_PURPLE = "#9C6AFF";
const COLOR_CORAL = "#F77F6A";
const COLOR_YELLOW = "#FFEEA5";

// Tints derived from the brand colors for soft backgrounds
const TINT_PURPLE_BG = "#F1EBFF"; // light wash of COLOR_LIGHT_PURPLE
const TINT_CORAL_BG = "#FDECE9"; // light wash of COLOR_CORAL
const TINT_YELLOW_BG = "#FFF9E0"; // light wash of COLOR_YELLOW

// Scale-answer accents (Often / Sometimes / Rarely / Not Yet)
const SCALE_COLORS: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  Often: { bg: "#DCFCE7", text: "#166534", border: "#86EFAC" },
  Sometimes: { bg: "#DBEAFE", text: "#1D4ED8", border: "#93C5FD" },
  Rarely: { bg: TINT_YELLOW_BG, text: "#92722A", border: COLOR_YELLOW },
  "Not Yet": { bg: TINT_CORAL_BG, text: COLOR_CORAL, border: COLOR_CORAL },
};
const SCALE_OPTIONS = ["Often", "Sometimes", "Rarely", "Not Yet"];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BuildFeedbackReportHtmlOptions {
  assetsDir: string;
  parentName: string;
  parentEmail: string;
  submittedAt: Date;
  accountSince: Date;
  childName: string;
  childAge: number;
  feedback: Record<string, unknown>;
}

interface FeedbackAnswer {
  text?: string;
  answerType?: string;
  selected?: boolean;
  placeholder?: string;
}

interface FeedbackQuestion {
  question: string;
  gridColumn?: string;
  questionType: string;
  answer: FeedbackAnswer[];
}

// A rendered item in the flattened question list: either a normal question
// or a group of consecutive scale (Often/Sometimes/Rarely/Not Yet) questions.
type ReportItem =
  | { kind: "question"; question: FeedbackQuestion }
  | { kind: "scaleGroup"; questions: FeedbackQuestion[] };

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
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(date));
}

function formatMonthYear(date: Date): string {
  return new Intl.DateTimeFormat("en-AU", {
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

function isScaleQuestion(question: FeedbackQuestion): boolean {
  if (question.questionType !== "single_tag") return false;
  const texts = (question.answer || []).map((a) => a.text);
  return (
    texts.length === SCALE_OPTIONS.length &&
    SCALE_OPTIONS.every((opt, i) => texts[i] === opt)
  );
}

// Groups consecutive scale questions (Often/Sometimes/Rarely/Not Yet) into a
// single "Changes You Have Noticed" block; everything else stays as-is.
function groupReportItems(questions: FeedbackQuestion[]): ReportItem[] {
  const items: ReportItem[] = [];
  let i = 0;
  while (i < questions.length) {
    const q = questions[i];
    if (isScaleQuestion(q)) {
      const group: FeedbackQuestion[] = [];
      while (i < questions.length && isScaleQuestion(questions[i])) {
        group.push(questions[i]);
        i++;
      }
      items.push({ kind: "scaleGroup", questions: group });
    } else {
      items.push({ kind: "question", question: q });
      i++;
    }
  }
  return items;
}

// ---------------------------------------------------------------------------
// Question Renderers
// ---------------------------------------------------------------------------

function getSelectedAnswers(answers: FeedbackAnswer[]): string[] {
  const selected: string[] = [];
  for (const a of answers) {
    if (a.selected) {
      if (a.answerType === "free_text_select_option" && a.text) {
        selected.push(a.text);
      } else if (a.text) {
        selected.push(a.text);
      }
    }
  }
  return selected;
}

function getFreeTextAnswer(answers: FeedbackAnswer[]): string | null {
  for (const a of answers) {
    if (a.answerType === "free_text_option" && a.text) {
      return a.text;
    }
  }
  return null;
}

function getSingleTagSelected(answers: FeedbackAnswer[]): string | null {
  for (const a of answers) {
    if (a.selected && a.text) {
      return a.text;
    }
  }
  return null;
}

function getSingleSelectSelected(answers: FeedbackAnswer[]): string | null {
  for (const a of answers) {
    if (a.selected && a.text) {
      return a.text;
    }
  }
  return null;
}

function getSingleSelectWithFreeText(answers: FeedbackAnswer[]): {
  selected: string | null;
  freeText: string | null;
} {
  let selected: string | null = null;
  let freeText: string | null = null;
  for (const a of answers) {
    if (a.selected) {
      if (a.answerType === "free_text_select_option") {
        if (a.text) freeText = a.text;
      } else if (!selected) {
        selected = a.text || null;
      }
    }
  }
  return { selected, freeText };
}

// ---------------------------------------------------------------------------
// HTML Builders
// ---------------------------------------------------------------------------

function buildOptionPill(text: string, selected: boolean): string {
  const base =
    "display:inline-block;padding:6px 14px;border-radius:9999px;font-size:13px;font-weight:500;margin:0 6px 6px 0;";
  if (selected) {
    return `<span style="${base}background:#DCFCE7;color:#166534;border:1px solid #86EFAC;">✓ ${escapeHtml(text)}</span>`;
  }
  return `<span style="${base}background:#F3F4F6;color:#9CA3AF;border:1px solid #E5E7EB;">${escapeHtml(text)}</span>`;
}

function buildFreeTextBox(text: string): string {
  return `<div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;padding:12px 16px;font-size:14px;color:${COLOR_NAVY};font-style:italic;margin-top:8px;">"${escapeHtml(text)}"</div>`;
}

function buildTypeBadge(label: string): string {
  if (label === "Single choice") {
    return `<span style="font-size:11px;font-weight:600;color:${COLOR_CORAL};background:${TINT_CORAL_BG};padding:3px 10px;border-radius:9999px;">${label}</span>`;
  }
  if (label === "Multiple choice") {
    return `<span style="font-size:11px;font-weight:600;color:${COLOR_PURPLE};background:${TINT_PURPLE_BG};padding:3px 10px;border-radius:9999px;">${label}</span>`;
  }
  return `<span style="font-size:11px;font-weight:600;color:#9CA3AF;background:#F3F4F6;padding:3px 10px;border-radius:9999px;">${label}</span>`;
}

function buildQuestionHeader(
  index: number,
  questionText: string,
  typeLabel: string | null,
): string {
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px;">
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:${TINT_PURPLE_BG};color:${COLOR_PURPLE};font-size:12px;font-weight:700;">${index}</span>
        <span style="font-size:15px;font-weight:700;color:${COLOR_NAVY};">${escapeHtml(questionText)}</span>
      </div>
      ${typeLabel ? buildTypeBadge(typeLabel) : ""}
    </div>
  `;
}

function buildQuestionBody(question: FeedbackQuestion): string {
  const qType = question.questionType;
  const answers = question.answer || [];
  let body = "";

  if (qType === "single_select_with_free_text") {
    const { selected, freeText } = getSingleSelectWithFreeText(answers);
    const allOptions = answers
      .filter((a) => a.answerType !== "free_text_select_option")
      .map((a) => a.text || "");
    const freeTextOption = answers.find(
      (a) => a.answerType === "free_text_select_option",
    );
    const freeTextLabel = freeTextOption?.text || "Other";

    body += `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">`;
    for (const opt of allOptions) {
      const isSelected = opt === selected;
      body += buildOptionPill(opt, isSelected);
    }
    body += buildOptionPill(freeTextLabel, !!freeText);
    body += `</div>`;
    if (freeText) {
      body += `<div style="margin-top:8px;font-size:11px;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:0.5px;">OTHER COUNTRY</div>`;
      body += buildFreeTextBox(freeText);
    }
  } else if (qType === "single_select") {
    const selectedText = getSingleSelectSelected(answers);
    body += `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">`;
    for (const a of answers) {
      if (!a.text) continue;
      body += buildOptionPill(a.text, a.text === selectedText);
    }
    body += `</div>`;
  } else if (qType === "multi_select") {
    const selectedTexts = getSelectedAnswers(answers);
    body += `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">`;
    for (const a of answers) {
      if (!a.text) continue;
      body += buildOptionPill(a.text, selectedTexts.includes(a.text));
    }
    body += `</div>`;
  } else if (qType === "single_tag") {
    const selectedText = getSingleTagSelected(answers);
    body += `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">`;
    for (const a of answers) {
      if (!a.text) continue;
      body += buildOptionPill(a.text, a.text === selectedText);
    }
    body += `</div>`;
  } else if (qType === "free_text" || qType === "free_singletext") {
    const text = getFreeTextAnswer(answers);
    if (text) {
      body += buildFreeTextBox(text);
    } else {
      body += `<div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;padding:12px 16px;font-size:14px;color:#9CA3AF;font-style:italic;margin-top:8px;">No response</div>`;
    }
  }

  return body;
}

function typeLabelFor(qType: string): string | null {
  if (qType === "single_select" || qType === "single_select_with_free_text") {
    return "Single choice";
  }
  if (qType === "multi_select") return "Multiple choice";
  if (qType === "single_tag") return "Single choice";
  return null; // free text / free singletext: no badge
}

function buildStandardQuestionBlock(
  index: number,
  question: FeedbackQuestion,
): string {
  return `
    <div style="margin-bottom:28px;">
      ${buildQuestionHeader(index, question.question, typeLabelFor(question.questionType))}
      ${buildQuestionBody(question)}
    </div>
  `;
}

// Renders one row of the "Changes You Have Noticed" scale group: the row
// label on the left, and the 4 fixed options (Often/Sometimes/Rarely/Not
// Yet) on the right, with the selected one tinted per SCALE_COLORS.
function buildScaleRow(question: FeedbackQuestion): string {
  const selected = getSingleTagSelected(question.answer || []);
  const pills = SCALE_OPTIONS.map((opt) => {
    const isSelected = opt === selected;
    const colors = SCALE_COLORS[opt];
    const style = isSelected
      ? `background:${colors.bg};color:${colors.text};border:1px solid ${colors.border};`
      : `background:#F3F4F6;color:#9CA3AF;border:1px solid #E5E7EB;`;
    return `<span style="display:inline-block;padding:5px 12px;border-radius:9999px;font-size:12px;font-weight:500;margin:0 6px 0 0;${style}">${isSelected ? "✓ " : ""}${opt}</span>`;
  }).join("");

  return `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid #F3F4F6;">
      <span style="font-size:14px;font-weight:600;color:${COLOR_NAVY};">${escapeHtml(question.question)}</span>
      <div style="display:flex;flex-wrap:nowrap;flex-shrink:0;">${pills}</div>
    </div>
  `;
}

function buildScaleGroupBlock(
  index: number,
  questions: FeedbackQuestion[],
): string {
  const rows = questions.map((q) => buildScaleRow(q)).join("");
  return `
    <div style="margin-bottom:28px;">
      ${buildQuestionHeader(index, "Changes You Have Noticed", "Multiple choice")}
      <div style="margin-top:8px;">
        ${rows}
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Main HTML Builder
// ---------------------------------------------------------------------------

export function buildFeedbackReportHtml(
  options: BuildFeedbackReportHtmlOptions,
): string {
  const {
    assetsDir,
    parentName,
    parentEmail,
    submittedAt,
    accountSince,
    childName,
    childAge,
    feedback,
  } = options;

  const logoDataUri = loadAsset(assetsDir, "logo.svg");

  // Flatten all sections into a single ordered list of questions
  const allQuestions: FeedbackQuestion[] = [];
  const sections = feedback as Record<string, FeedbackQuestion[]>;
  if (sections && typeof sections === "object") {
    for (const sectionKey of Object.keys(sections).sort()) {
      const section = sections[sectionKey];
      if (Array.isArray(section)) {
        for (const q of section) {
          if (q && q.question) {
            allQuestions.push(q);
          }
        }
      }
    }
  }

  const reportItems = groupReportItems(allQuestions);
  const questionBlocks = reportItems
    .map((item, i) =>
      item.kind === "scaleGroup"
        ? buildScaleGroupBlock(i + 1, item.questions)
        : buildStandardQuestionBlock(i + 1, item.question),
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=794">
<title>Parent Reflection - ${escapeHtml(childName)}</title>
<link href="https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Nunito Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    background: ${TINT_PURPLE_BG};
    color: ${COLOR_NAVY};
    line-height: 1.5;
  }
</style>
</head>
<body>
<div style="max-width:794px;margin:0 auto;background:${TINT_PURPLE_BG};padding:32px 24px;">

  <!-- Header Card -->
  <div style="background:${COLOR_WHITE};border-radius:20px;padding:24px;margin-bottom:24px;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:40px;height:40px;border-radius:10px;background:${TINT_PURPLE_BG};display:flex;align-items:center;justify-content:center;overflow:hidden;">
          <img src="${logoDataUri}" style="width:28px;height:28px;" alt="logo">
        </div>
        <div>
          <div style="font-size:18px;font-weight:800;color:${COLOR_NAVY};">Parent Reflection Submitted</div>
          <div style="font-size:13px;color:#6B7280;">A parent has completed the Busy Brains feedback form</div>
        </div>
      </div>
      <span style="font-size:12px;font-weight:600;color:${COLOR_WHITE};background:${COLOR_PURPLE};padding:6px 14px;border-radius:9999px;">Parent Feedback</span>
    </div>
  </div>

  <!-- Submission Summary -->
  <div style="margin-bottom:24px;">
    <div style="font-size:18px;font-weight:800;color:${COLOR_NAVY};margin-bottom:16px;">Submission Summary</div>
    <div style="background:${COLOR_WHITE};border-radius:16px;padding:20px;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:36px;height:36px;border-radius:50%;background:${TINT_PURPLE_BG};display:flex;align-items:center;justify-content:center;font-size:14px;">👤</div>
          <div>
            <div style="font-size:11px;color:#9CA3AF;font-weight:500;">Parents Name</div>
            <div style="font-size:14px;font-weight:700;color:${COLOR_NAVY};">${escapeHtml(parentName)}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:36px;height:36px;border-radius:50%;background:${TINT_PURPLE_BG};display:flex;align-items:center;justify-content:center;font-size:14px;">✉️</div>
          <div>
            <div style="font-size:11px;color:#9CA3AF;font-weight:500;">Email</div>
            <div style="font-size:14px;font-weight:700;color:${COLOR_NAVY};">${escapeHtml(parentEmail)}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:36px;height:36px;border-radius:50%;background:${TINT_PURPLE_BG};display:flex;align-items:center;justify-content:center;font-size:14px;">🕐</div>
          <div>
            <div style="font-size:11px;color:#9CA3AF;font-weight:500;">Submitted</div>
            <div style="font-size:14px;font-weight:700;color:${COLOR_NAVY};">${formatDate(submittedAt)}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:36px;height:36px;border-radius:50%;background:${TINT_PURPLE_BG};display:flex;align-items:center;justify-content:center;font-size:14px;">📅</div>
          <div>
            <div style="font-size:11px;color:#9CA3AF;font-weight:500;">Account Since</div>
            <div style="font-size:14px;font-weight:700;color:${COLOR_NAVY};">${formatMonthYear(accountSince)}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:36px;height:36px;border-radius:50%;background:${TINT_PURPLE_BG};display:flex;align-items:center;justify-content:center;font-size:14px;">👶</div>
          <div>
            <div style="font-size:11px;color:#9CA3AF;font-weight:500;">Child Name</div>
            <div style="font-size:14px;font-weight:700;color:${COLOR_NAVY};">${escapeHtml(childName)}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:36px;height:36px;border-radius:50%;background:${TINT_PURPLE_BG};display:flex;align-items:center;justify-content:center;font-size:14px;">📊</div>
          <div>
            <div style="font-size:11px;color:#9CA3AF;font-weight:500;">Child Age</div>
            <div style="font-size:14px;font-weight:700;color:${COLOR_NAVY};">${childAge}</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Full Parent Feedback -->
  <div style="margin-bottom:24px;">
    <div style="font-size:18px;font-weight:800;color:${COLOR_NAVY};margin-bottom:4px;">Full Parent Feedback</div>
    <div style="font-size:13px;color:#6B7280;margin-bottom:16px;">All answers from the parent's submission below.</div>
    <div style="background:${COLOR_WHITE};border-radius:16px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
      ${questionBlocks}
    </div>
  </div>

  <!-- Admin Review Notes -->
  <div style="background:${TINT_YELLOW_BG};border:1px solid ${COLOR_YELLOW};border-radius:16px;padding:20px;margin-bottom:24px;">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
      <div style="width:28px;height:28px;border-radius:50%;background:${COLOR_YELLOW};display:flex;align-items:center;justify-content:center;font-size:14px;">💡</div>
      <div style="font-size:16px;font-weight:800;color:${COLOR_NAVY};">Admin Review Notes</div>
    </div>
    <div style="font-size:13px;color:${COLOR_NAVY};line-height:1.6;">
      This parent reflection can help the Busy Brains team understand family context, observed changes, helpful program areas, and future improvement opportunities.
    </div>
  </div>

  <!-- Footer -->
  <div style="text-align:center;padding:16px 0;">
    <div style="font-size:14px;font-weight:700;color:${COLOR_NAVY};margin-bottom:4px;">Busy Brains Feedback System</div>
    <div style="font-size:12px;color:#9CA3AF;">This email was generated automatically after a parent submitted the Parent Reflection form.</div>
    <div style="font-size:11px;color:#9CA3AF;margin-top:4px;">Please do not reply directly to this email.</div>
  </div>

</div>
</body>
</html>`;
}
