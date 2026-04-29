import { accountDeletionOtpTemplate } from "./templates/account-deletion";
import { EmailTemplateMap } from "./types";

type TemplateRenderer<T> = (data: T) => string;

export const templateRegistry: {
  [K in keyof EmailTemplateMap]: {
    subject: (data: EmailTemplateMap[K]) => string;
    render: TemplateRenderer<EmailTemplateMap[K]>;
  };
} = {
  ACCOUNT_DELETION_OTP: {
    subject: () => "Your Account Deletion OTP",
    render: accountDeletionOtpTemplate,
  },
};
