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
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ClerkGuard,
    },
  ],
})
export class AppModule {}
