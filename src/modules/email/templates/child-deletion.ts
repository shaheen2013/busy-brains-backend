export const childDeletionOtpTemplate = (data: {
  parentName: string;
  childName: string;
  otp: string;
}) => `
<mjml>
  <mj-head>
    <mj-font
      name="Inter"
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
    />
    <mj-attributes>
      <mj-all font-family="Inter, Arial, sans-serif" />
      <mj-text font-size="14px" line-height="1.7" color="#000000" />
    </mj-attributes>
  </mj-head>

  <mj-body background-color="#ffffff">

    <mj-section background-color="#ffffff" padding="40px 24px 16px">
      <mj-column>
        <mj-text
          font-size="28px"
          font-weight="600"
          color="#000000"
          padding-bottom="24px"
        >
          Child Profile Deletion
        </mj-text>

        <mj-text padding-bottom="16px">
          Hi ${data.parentName},
        </mj-text>

        <mj-text padding-bottom="16px">
          We received a request to permanently delete the profile for
          <strong>${data.childName}</strong>.
        </mj-text>

        <mj-text padding-bottom="24px">
          Use the verification code below to confirm this action.
        </mj-text>

        <mj-text
          align="center"
          font-size="36px"
          font-weight="700"
          letter-spacing="10px"
          color="#000000"
          padding="24px 0"
          background-color="#f5f5f5"
        >
          ${data.otp}
        </mj-text>

        <mj-text
          align="center"
          font-size="12px"
          color="#666666"
          padding-top="12px"
          padding-bottom="24px"
        >
          Expires in 10 minutes
        </mj-text>

        <mj-text padding-bottom="16px">
          This action will permanently delete
          <strong>${data.childName}&apos;s</strong> profile and all associated
          progress data. This action cannot be undone.
        </mj-text>

        <mj-text color="#666666" padding-bottom="32px">
          If you didn&apos;t request this, you can safely ignore this email.
        </mj-text>

        <mj-text padding-bottom="0">
          Busy Brains Team
        </mj-text>
      </mj-column>
    </mj-section>

  </mj-body>
</mjml>
`;
