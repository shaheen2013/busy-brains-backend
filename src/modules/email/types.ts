export enum EmailTemplate {
  ACCOUNT_DELETION_OTP = "ACCOUNT_DELETION_OTP",
  CHILD_DELETION_OTP = "CHILD_DELETION_OTP",
}

export type EmailTemplateMap = {
  ACCOUNT_DELETION_OTP: {
    name: string;
    otp: string;
  };
  CHILD_DELETION_OTP: {
    parentName: string;
    childName: string;
    otp: string;
  };
};
