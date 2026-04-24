import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from "@nestjs/typeorm";
import { AppConfig } from "./app.config";
import { User } from "../entities/user.entity";
import { Payment } from "../entities/payment.entity";
import { Subscription } from "../entities/subscription.entity";

@Injectable()
export class DatabaseConfigService implements TypeOrmOptionsFactory {
  constructor(private configService: ConfigService<AppConfig>) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    const nodeEnv = this.configService.get("nodeEnv", { infer: true });
    const isDev = nodeEnv !== "production";

    const database = this.configService.get("database", { infer: true })!;

    return {
      type: "postgres",
      host: database.host,
      port: database.port,
      username: database.user,
      password: database.password,
      database: database.name,

      entities: [User, Payment, Subscription],
      synchronize: isDev,
      logging: isDev,

      migrationsRun: false,
      migrations: isDev ? [] : [__dirname + "/../migrations/*.{ts,js}"],

      ssl: nodeEnv === "production" ? { rejectUnauthorized: false } : false,

      extra: {
        max: 3,
        keepAlive: true,
      },
    };
  }
}
