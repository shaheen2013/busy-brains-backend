export interface AppConfig {
  google: {
    clientId: string;
    clientSecret: string;
  };
  backendUrl: string;
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
  };

  clerk: {
    secretKey: string;
    webhookSecret: string;
  };

  stripe: {
    secretKey: string;
    publishableKey: string;
    webhookSecret: string;
    upgradePriceId: string;
  };

  s3: {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
  };
  kit: {
    apiKey: string;
    purchaseCompletionSequenceId: string;
    signupSequenceId: string;
    accountDeletionOtpSequenceId: string;
    childDeletionOtpSequenceId: string;
    feedbackReportSequenceId: string;
  };
  nodeEnv: string;
  port: number;
  frontendUrl: string;
  features: {
    startTrialOnSignup: boolean;
  };
}

export default (): AppConfig => ({
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  },
  backendUrl: process.env.BACKEND_URL || "http://localhost:3001",
  database: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "5432", 10),
    name: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  },

  clerk: {
    secretKey: process.env.CLERK_SECRET_KEY,
    webhookSecret: process.env.CLERK_WEBHOOK_SECRET,
  },

  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    upgradePriceId: process.env.STRIPE_PRICE_UPGRADE,
  },
  s3: {
    region: process.env.AWS_REGION || "us-east-1",
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    bucket: process.env.AWS_S3_BUCKET || "",
  },
  kit: {
    apiKey: process.env.KIT_API_KEY || "",
    purchaseCompletionSequenceId:
      process.env.KIT_PURCHASE_COMPLETION_SEQUENCE_ID || "",
    signupSequenceId: process.env.KIT_SIGNUP_SEQUENCE_ID || "",
    accountDeletionOtpSequenceId:
      process.env.KIT_ACCOUNT_DELETION_OTP_SEQUENCE_ID || "",
    childDeletionOtpSequenceId:
      process.env.KIT_CHILD_DELETION_OTP_SEQUENCE_ID || "",
    feedbackReportSequenceId: process.env.KIT_FEEDBACK_REPORT_SEQUENCE_ID || "",
  },
  nodeEnv: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "3001", 10),
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
  features: {
    startTrialOnSignup: process.env.START_TRIAL_ON_SIGNUP === "true",
  },
});
