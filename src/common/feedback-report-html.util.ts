import { readFileSync } from "fs";
import { join } from "path";

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

function getSingleSelectWithFreeText(answers: FeedbackAnswer[]): { selected: string | null; freeText: string | null } {
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
  const base = "display:inline-block;padding:6px 14px;border-radius:9999px;font-size:13px;font-weight:500;margin:0 6px 6px 0;";
  if (selected) {
    return `<span style="${base}background:#DCFCE7;color:#166534;border:1px solid #86EFAC;">✓ ${escapeHtml(text)}</span>`;
  }
  return `<span style="${base}background:#F3F4F6;color:#9CA3AF;border:1px solid #E5E7EB;">${escapeHtml(text)}</span>`;
}

function buildTagOption(text: string, selected: boolean): string {
  const base = "display:inline-block;padding:6px 14px;border-radius:9999px;font-size:13px;font-weight:500;margin:0 6px 6px 0;";
  if (selected) {
    return `<span style="${base}background:#DCFCE7;color:#166534;border:1px solid #86EFAC;">✓ ${escapeHtml(text)}</span>`;
  }
  return `<span style="${base}background:#F3F4F6;color:#9CA3AF;border:1px solid #E5E7EB;">${escapeHtml(text)}</span>`;
}

function buildFreeTextBox(text: string): string {
  return `<div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;padding:12px 16px;font-size:14px;color:#374151;font-style:italic;margin-top:8px;">"${escapeHtml(text)}"</div>`;
}

function buildQuestionBlock(
  index: number,
  question: FeedbackQuestion,
): string {
  const qType = question.questionType;
  const answers = question.answer || [];
  let body = "";

  if (qType === "single_select_with_free_text") {
    const { selected, freeText } = getSingleSelectWithFreeText(answers);
    const allOptions = answers
      .filter((a) => a.answerType !== "free_text_select_option")
      .map((a) => a.text || "");
    const freeTextOption = answers.find((a) => a.answerType === "free_text_select_option");
    const freeTextLabel = freeTextOption?.text || "Other";

    body += `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">`;
    for (const opt of allOptions) {
      const isSelected = opt === selected;
      body += buildOptionPill(opt, isSelected);
    }
    if (freeText) {
      body += buildOptionPill(freeTextLabel, true);
    } else {
      body += buildOptionPill(freeTextLabel, false);
    }
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
      body += buildTagOption(a.text, a.text === selectedText);
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

  const typeLabel =
    qType === "single_select" || qType === "single_select_with_free_text"
      ? "Single choice"
      : qType === "multi_select"
        ? "Multiple choice"
        : qType === "single_tag"
          ? "Single choice"
          : "Free text";

  return `
    <div style="margin-bottom:28px;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:#F3E8FF;color:#7C3AED;font-size:12px;font-weight:700;">${index}</span>
          <span style="font-size:15px;font-weight:600;color:#1F2937;">${escapeHtml(question.question)}</span>
        </div>
        <span style="font-size:11px;font-weight:500;color:#9CA3AF;background:#F3F4F6;padding:3px 10px;border-radius:9999px;">${typeLabel}</span>
      </div>
      ${body}
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

  const questionBlocks = allQuestions
    .map((q, i) => buildQuestionBlock(i + 1, q))
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
    background: #F5F3FF;
    color: #1F2937;
    line-height: 1.5;
  }
</style>
</head>
<body>
<div style="max-width:794px;margin:0 auto;background:#F5F3FF;padding:32px 24px;">

  <!-- Header Card -->
  <div style="background:#FFFFFF;border-radius:20px;padding:24px;margin-bottom:24px;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:40px;height:40px;border-radius:10px;background:#F3E8FF;display:flex;align-items:center;justify-content:center;overflow:hidden;">
          <img src="${logoDataUri}" style="width:28px;height:28px;" alt="logo">
        </div>
        <div>
          <div style="font-size:18px;font-weight:800;color:#7C3AED;">Parent Reflection Submitted</div>
          <div style="font-size:13px;color:#6B7280;">A parent has completed the Busy Brains feedback form</div>
        </div>
      </div>
      <span style="font-size:12px;font-weight:600;color:#7C3AED;background:#F3E8FF;padding:6px 14px;border-radius:9999px;">Parent Feedback</span>
    </div>
  </div>

  <!-- Submission Summary -->
  <div style="margin-bottom:24px;">
    <div style="font-size:18px;font-weight:800;color:#1F2937;margin-bottom:16px;">Submission Summary</div>
    <div style="background:#FFFFFF;border-radius:16px;padding:20px;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:36px;height:36px;border-radius:50%;background:#F3E8FF;display:flex;align-items:center;justify-content:center;font-size:14px;">👤</div>
          <div>
            <div style="font-size:11px;color:#9CA3AF;font-weight:500;">Parents Name</div>
            <div style="font-size:14px;font-weight:700;color:#1F2937;">${escapeHtml(parentName)}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:36px;height:36px;border-radius:50%;background:#F3E8FF;display:flex;align-items:center;justify-content:center;font-size:14px;">✉️</div>
          <div>
            <div style="font-size:11px;color:#9CA3AF;font-weight:500;">Email</div>
            <div style="font-size:14px;font-weight:700;color:#1F2937;">${escapeHtml(parentEmail)}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:36px;height:36px;border-radius:50%;background:#F3E8FF;display:flex;align-items:center;justify-content:center;font-size:14px;">🕐</div>
          <div>
            <div style="font-size:11px;color:#9CA3AF;font-weight:500;">Submitted</div>
            <div style="font-size:14px;font-weight:700;color:#1F2937;">${formatDate(submittedAt)}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:36px;height:36px;border-radius:50%;background:#F3E8FF;display:flex;align-items:center;justify-content:center;font-size:14px;">📅</div>
          <div>
            <div style="font-size:11px;color:#9CA3AF;font-weight:500;">Account Since</div>
            <div style="font-size:14px;font-weight:700;color:#1F2937;">${formatMonthYear(accountSince)}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:36px;height:36px;border-radius:50%;background:#F3E8FF;display:flex;align-items:center;justify-content:center;font-size:14px;">👶</div>
          <div>
            <div style="font-size:11px;color:#9CA3AF;font-weight:500;">Child Name</div>
            <div style="font-size:14px;font-weight:700;color:#1F2937;">${escapeHtml(childName)}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:36px;height:36px;border-radius:50%;background:#F3E8FF;display:flex;align-items:center;justify-content:center;font-size:14px;">📊</div>
          <div>
            <div style="font-size:11px;color:#9CA3AF;font-weight:500;">Child Age</div>
            <div style="font-size:14px;font-weight:700;color:#1F2937;">${childAge}</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Full Parent Feedback -->
  <div style="margin-bottom:24px;">
    <div style="font-size:18px;font-weight:800;color:#1F2937;margin-bottom:4px;">Full Parent Feedback</div>
    <div style="font-size:13px;color:#6B7280;margin-bottom:16px;">All answers from the parent's submission below.</div>
    <div style="background:#FFFFFF;border-radius:16px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
      ${questionBlocks}
    </div>
  </div>

  <!-- Admin Review Notes -->
  <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:16px;padding:20px;margin-bottom:24px;">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
      <div style="width:28px;height:28px;border-radius:50%;background:#FEF3C7;display:flex;align-items:center;justify-content:center;font-size:14px;">💡</div>
      <div style="font-size:16px;font-weight:800;color:#92400E;">Admin Review Notes</div>
    </div>
    <div style="font-size:13px;color:#92400E;line-height:1.6;">
      This parent reflection can help the Busy Brains team understand family context, observed changes, helpful program areas, and future improvement opportunities.
    </div>
  </div>

  <!-- Footer -->
  <div style="text-align:center;padding:16px 0;">
    <div style="font-size:14px;font-weight:700;color:#1F2937;margin-bottom:4px;">Busy Brains Feedback System</div>
    <div style="font-size:12px;color:#9CA3AF;">This email was generated automatically after a parent submitted the Parent Reflection form.</div>
    <div style="font-size:11px;color:#9CA3AF;margin-top:4px;">Please do not reply directly to this email.</div>
  </div>

</div>
</body>
</html>`;
}
