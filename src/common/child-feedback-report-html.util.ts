import {
  COLOR_CORAL,
  COLOR_NAVY,
  COLOR_WHITE,
  COLOR_YELLOW,
  TINT_CORAL_BG,
  TINT_PURPLE_BG,
  TINT_YELLOW_BG,
  buildAvatarCircle,
  escapeHtml,
  flattenFeedbackSections,
  formatDate,
  groupReportItems,
  renderQuestionBlocks,
} from "./feedback-report-shared.util";

interface BuildChildFeedbackReportHtmlOptions {
  childName: string;
  childAvatarUrl?: string | null;
  moduleLabel: string;
  responseTypeLabel: string;
  parentName: string;
  parentAvatarUrl?: string | null;
  parentEmail: string;
  submittedAt: Date;
  feedback: Record<string, unknown>;
}

export function buildChildFeedbackReportHtml(
  options: BuildChildFeedbackReportHtmlOptions,
): string {
  const {
    childName,
    childAvatarUrl,
    moduleLabel,
    responseTypeLabel,
    parentName,
    parentAvatarUrl,
    parentEmail,
    submittedAt,
    feedback,
  } = options;

  const questionBlocks = renderQuestionBlocks(
    groupReportItems(flattenFeedbackSections(feedback)),
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=794">
<title>Buddy Feedback - ${escapeHtml(childName)}</title>
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
  <div style="background:${TINT_CORAL_BG};border-radius:20px;padding:24px;margin-bottom:24px;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:40px;height:40px;border-radius:10px;background:${COLOR_WHITE};display:flex;align-items:center;justify-content:center;overflow:hidden;font-size:20px;">
          🧠
        </div>
        <div>
          <div style="font-size:18px;font-weight:800;color:${COLOR_CORAL};">Buddy Feedback Submitted</div>
          <div style="font-size:13px;color:#6B7280;">A child has completed the Busy Brains final quiz.</div>
        </div>
      </div>
      <span style="font-size:12px;font-weight:600;color:${COLOR_WHITE};background:${COLOR_CORAL};padding:6px 14px;border-radius:9999px;">Kids Feedback</span>
    </div>
  </div>

  <!-- Submission Summary -->
  <div style="margin-bottom:24px;">
    <div style="font-size:18px;font-weight:800;color:${COLOR_NAVY};margin-bottom:16px;">Submission Summary</div>
    <div style="background:${COLOR_WHITE};border-radius:16px;padding:20px;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:36px;height:36px;border-radius:50%;background:${TINT_PURPLE_BG};display:flex;align-items:center;justify-content:center;font-size:14px;overflow:hidden;">
            ${buildAvatarCircle(childAvatarUrl, "🧒")}
          </div>
          <div>
            <div style="font-size:11px;color:#9CA3AF;font-weight:500;">Child Name</div>
            <div style="font-size:14px;font-weight:700;color:${COLOR_NAVY};">${escapeHtml(childName)}</div>
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
          <div style="width:36px;height:36px;border-radius:50%;background:${TINT_PURPLE_BG};display:flex;align-items:center;justify-content:center;font-size:14px;">📘</div>
          <div>
            <div style="font-size:11px;color:#9CA3AF;font-weight:500;">Module</div>
            <div style="font-size:14px;font-weight:700;color:${COLOR_NAVY};">${escapeHtml(moduleLabel)}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:36px;height:36px;border-radius:50%;background:${TINT_PURPLE_BG};display:flex;align-items:center;justify-content:center;font-size:14px;">🏷️</div>
          <div>
            <div style="font-size:11px;color:#9CA3AF;font-weight:500;">Response Type</div>
            <div style="font-size:14px;font-weight:700;color:${COLOR_NAVY};">${escapeHtml(responseTypeLabel)}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:36px;height:36px;border-radius:50%;background:${TINT_PURPLE_BG};display:flex;align-items:center;justify-content:center;font-size:14px;overflow:hidden;">
            ${buildAvatarCircle(parentAvatarUrl, "👤")}
          </div>
          <div>
            <div style="font-size:11px;color:#9CA3AF;font-weight:500;">Parents Name</div>
            <div style="font-size:14px;font-weight:700;color:${COLOR_NAVY};">${escapeHtml(parentName)}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:36px;height:36px;border-radius:50%;background:${TINT_PURPLE_BG};display:flex;align-items:center;justify-content:center;font-size:14px;">✉️</div>
          <div>
            <div style="font-size:11px;color:#9CA3AF;font-weight:500;">Parent Email</div>
            <div style="font-size:14px;font-weight:700;color:${COLOR_NAVY};">${escapeHtml(parentEmail)}</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Full Quiz Responses -->
  <div style="margin-bottom:24px;">
    <div style="font-size:18px;font-weight:800;color:${COLOR_NAVY};margin-bottom:4px;">Full Quiz Responses</div>
    <div style="font-size:13px;color:#6B7280;margin-bottom:16px;">All answers from the child's submission below.</div>
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
      This feedback can help the Busy Brains team understand what children found most engaging, what learning felt meaningful, and where the experience can be improved.
    </div>
  </div>

  <!-- Footer -->
  <div style="text-align:center;padding:16px 0;">
    <div style="font-size:14px;font-weight:700;color:${COLOR_NAVY};margin-bottom:4px;">Busy Brains Feedback System</div>
    
  </div>

</div>
</body>
</html>`;
}
