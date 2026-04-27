export interface AppConfig {
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
  };

  nodeEnv: string;
  port: number;
}

export default (): AppConfig => ({
  database: {
    host: process.env.DB_HOST!,
    port: parseInt(process.env.DB_PORT || "5432", 10),
    name: process.env.DB_NAME!,
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
  },

  clerk: {
    secretKey: process.env.CLERK_SECRET_KEY!,
    webhookSecret: process.env.CLERK_WEBHOOK_SECRET!,
  },

  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY!,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY!,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
  },
  nodeEnv: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "3001", 10),
});
