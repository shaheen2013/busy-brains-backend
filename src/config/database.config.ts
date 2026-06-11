import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from "@nestjs/typeorm";
import { AppConfig } from "./app.config";
import { User } from "../modules/users/entities/user.entity";
import { Child } from "../modules/children/entities/child.entity";
import { ChildModule } from "../modules/children/entities/child-module.entity";
import { ChildQuest } from "../modules/children/entities/child-quest.entity";
import { ChildScreen } from "../modules/children/entities/child-screen.entity";
import { Plan } from "../modules/subscriptions/entities/plan.entity";
import { UserPlan } from "../modules/subscriptions/entities/user-plan.entity";
import { PaymentHistory } from "../modules/subscriptions/entities/payment-history.entity";
import { Resource } from "../modules/storage/entities/resource.entity";
import { Document } from "../modules/storage/entities/document.entity";
import { VerificationToken } from "../modules/users/entities/verification-token.entity";

@Injectable()
export class DatabaseConfigService implements TypeOrmOptionsFactory {
  constructor(private configService: ConfigService<AppConfig>) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    const nodeEnv = this.configService.get("nodeEnv", { infer: true });
    const isDev = nodeEnv !== "production";

    const database = this.configService.get("database", { infer: true });

    return {
      type: "postgres",
      host: database.host,
      port: database.port,
      username: database.user,
      password: database.password,
      database: database.name,

      entities: [
        User,
        Child,
        ChildModule,
        ChildQuest,
        ChildScreen,
        Plan,
        UserPlan,
        PaymentHistory,
        Resource,
        Document,
        VerificationToken,
      ],
      synchronize: isDev,
      logging: isDev,

      migrationsRun: false,
      migrations: isDev ? [] : [__dirname + "/../migrations/*.{ts,js}"],

      ssl: false,

      extra: {
        max: 50,
        keepAlive: true,
      },
    };
  }
}
