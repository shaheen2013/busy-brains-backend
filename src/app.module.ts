import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";

import { validate } from "./config/env";
import appConfig from "./config/app.config";
import { DatabaseConfigService } from "./config/database.config";

import { AuthModule } from "./modules/auth/auth.module";
import { ClerkGuard } from "./modules/auth/guards/clerk.guard";
import { UsersModule } from "./modules/users/users.module";
import { WebhooksModule } from "./modules/webhooks/webhooks.module";
import { HealthModule } from "./modules/health/health.module";
import { PaymentModule } from "./modules/payment/payment.module";
import { ModulesModule } from "./modules/modules/modules.module";
import { ChildrenModule } from "./modules/children/children.module";
import { ProgressModule } from "./modules/progress/progress.module";
import { StorageModule } from "./modules/storage/storage.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { ParentResourcesModule } from "./modules/parent-resources/parent-resources.module";
import { KitModule } from "./modules/kit/kit.module";
import { ToolkitReportModule } from "./modules/toolkit-report/toolkit-report.module";
import { CertificateReportModule } from "./modules/certificate-report/certificate-report.module";
import { FeedbackModule } from "./modules/feedback/feedback.module";
import { FeedbackReportModule } from "./modules/feedback-report/feedback-report.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      validate,
      envFilePath: ".env",
    }),
    TypeOrmModule.forRootAsync({
      useClass: DatabaseConfigService,
    }),
    AuthModule,
    UsersModule,
    WebhooksModule,
    HealthModule,
    PaymentModule,
    ModulesModule,
    ChildrenModule,
    ProgressModule,
    StorageModule,
    DashboardModule,
    ParentResourcesModule,
    KitModule,
    ToolkitReportModule,
    CertificateReportModule,
    FeedbackModule,
    FeedbackReportModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ClerkGuard,
    },
  ],
})
export class AppModule {}
