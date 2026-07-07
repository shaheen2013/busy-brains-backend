// Shared building blocks for parent (feedback-report-html.util.ts) and child
// (child-feedback-report-html.util.ts) feedback PDF report templates —
// question rendering is identical between the two; only the page shell
// (header, summary fields, copy, colors) differs per audience.

// ---------------------------------------------------------------------------
// Brand palette
// ---------------------------------------------------------------------------

export const COLOR_NAVY = "#34586E";
export const COLOR_WHITE = "#FFFFFF";
export const COLOR_PURPLE = "#9C6AFF";
export const COLOR_CORAL = "#F77F6A";
export const COLOR_YELLOW = "#FFEEA5";

// Tints derived from the brand colors for soft backgrounds
export const TINT_PURPLE_BG = "#F1EBFF"; // light wash of the brand light-purple
export const TINT_CORAL_BG = "#FDECE9"; // light wash of COLOR_CORAL
export const TINT_YELLOW_BG = "#FFF9E0"; // light wash of COLOR_YELLOW

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

export interface FeedbackAnswer {
  text?: string;
  answerType?: string;
  selected?: boolean;
  placeholder?: string;
}

export interface FeedbackQuestion {
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
// Generic helpers
// ---------------------------------------------------------------------------

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(date));
}

export function formatMonthYear(date: Date): string {
  return new Intl.DateTimeFormat("en-AU", {
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

// Renders an avatar circle's inner content: an <img> when a URL is provided,
// otherwise a fallback emoji.
export function buildAvatarCircle(
  avatarUrl: string | null | undefined,
  fallbackEmoji: string,
): string {
  return avatarUrl
    ? `<img src="${escapeHtml(avatarUrl)}" style="width:100%;height:100%;object-fit:cover;" alt="avatar">`
    : fallbackEmoji;
}

// Flattens a `{ sectionKey: Question[] }` feedback payload into a single
// ordered list of questions (sections sorted by key for stable ordering).
export function flattenFeedbackSections(
  feedback: Record<string, unknown>,
): FeedbackQuestion[] {
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
  return allQuestions;
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
export function groupReportItems(questions: FeedbackQuestion[]): ReportItem[] {
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

// Renders a flattened list of report items (questions / scale groups) into
// the numbered HTML blocks shown under "Full Parent Feedback" / "Full Quiz
// Responses".
export function renderQuestionBlocks(items: ReportItem[]): string {
  return items
    .map((item, i) =>
      item.kind === "scaleGroup"
        ? buildScaleGroupBlock(i + 1, item.questions)
        : buildStandardQuestionBlock(i + 1, item.question),
    )
    .join("\n");
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
  return `<div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;padding:12px 16px;font-size:14px;color:${COLOR_NAVY};font-style:italic;margin-top:8px;">${escapeHtml(text)}</div>`;
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
