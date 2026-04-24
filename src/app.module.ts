import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";

import { validate } from "./config/env";
import appConfig from "./config/app.config";
import { DatabaseConfigService } from "./config/database.config";

import { AuthModule } from "./modules/auth/auth.module";
import { WebhooksModule } from "./modules/webhooks/webhooks.module";
import { HealthModule } from "./modules/health/health.module";

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
    WebhooksModule,
    HealthModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
