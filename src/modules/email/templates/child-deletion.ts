export const childDeletionOtpTemplate = (data: {
  parentName: string;
  childName: string;
  otp: string;
}) => `
<mjml>
  <mj-head>
    <mj-font name="Inter" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" />
    <mj-attributes>
      <mj-all font-family="Inter, Arial, sans-serif" />
      <mj-text font-size="14px" line-height="1.6" color="#dbdee1" />
    </mj-attributes>
  </mj-head>

  <mj-body background-color="#1e1f22">

    <!-- Header -->
    <mj-section background-color="#2b2d31" border-radius="12px 12px 0 0" padding="28px 32px 16px">
      <mj-column>
        <mj-text align="center" font-size="20px" font-weight="700" color="#ffffff" padding-bottom="2px">
          🧠 Busy Brains
        </mj-text>
        <mj-text align="center" font-size="12px" color="#80848e" padding-top="0" padding-bottom="0">
          Account Security
        </mj-text>
      </mj-column>
    </mj-section>

    <!-- Red accent bar -->
    <mj-section background-color="#f23f42" padding="3px 0" />

    <!-- Greeting + intro -->
    <mj-section background-color="#2b2d31" padding="32px 32px 0">
      <mj-column>
        <mj-text font-size="22px" font-weight="700" color="#ffffff" padding-bottom="12px">
          Child Profile Deletion Request
        </mj-text>
        <mj-text color="#dbdee1" padding-bottom="16px">
          Hi <strong style="color:#ffffff">${data.parentName}</strong>,
        </mj-text>
        <mj-text color="#dbdee1" padding-bottom="0">
          We received a request to permanently delete the profile for
          <strong style="color:#ffffff">${data.childName}</strong>.
          Use the verification code below to confirm this action.
        </mj-text>
      </mj-column>
    </mj-section>

    <!-- OTP box -->
    <mj-section background-color="#2b2d31" padding="24px 32px">
      <mj-column background-color="#1e1f22" border-radius="10px" padding="24px 20px">
        <mj-text align="center" font-size="11px" font-weight="600" color="#80848e" padding-bottom="12px">
          VERIFICATION CODE
        </mj-text>
        <mj-text align="center" font-size="40px" font-weight="700" color="#ffffff" padding="0 0 12px 0"
          container-background-color="#1e1f22">
          <span style="letter-spacing:12px;padding-left:12px">${data.otp}</span>
        </mj-text>
        <mj-text align="center" font-size="12px" color="#80848e" padding-top="0" padding-bottom="0">
          Expires in <span style="color:#f0b132;font-weight:600">10 minutes</span>
        </mj-text>
      </mj-column>
    </mj-section>

    <!-- Warning -->
    <mj-section background-color="#2b2d31" padding="0 32px 24px">
      <mj-column border-radius="8px" padding="16px" background-color="#2a1a1b">
        <mj-text font-size="13px" color="#dbdee1" padding="0">
          ⚠️ <strong style="color:#f23f42">Warning:</strong> This will permanently delete
          <strong style="color:#ffffff">${data.childName}&apos;s</strong> profile and all associated
          progress data. This action <strong style="color:#ffffff">cannot be undone</strong>.
        </mj-text>
      </mj-column>
    </mj-section>

    <!-- Ignore notice -->
    <mj-section background-color="#2b2d31" padding="0 32px 28px">
      <mj-column>
        <mj-text font-size="13px" color="#80848e" padding="0">
          If you didn&apos;t request this, you can safely ignore this email. No changes will be made.
        </mj-text>
      </mj-column>
    </mj-section>

    <!-- Footer -->
    <mj-section background-color="#313338" border-radius="0 0 12px 12px" padding="20px 32px">
      <mj-column>
        <mj-text align="center" font-size="12px" color="#80848e" padding-bottom="4px">
          &copy; ${new Date().getFullYear()} Busy Brains &middot; All rights reserved
        </mj-text>
        <mj-text align="center" font-size="12px" color="#80848e" padding-top="0" padding-bottom="0">
          This email was sent because a child profile deletion was requested on your account.
        </mj-text>
      </mj-column>
    </mj-section>

  </mj-body>
</mjml>
`;
