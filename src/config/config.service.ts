import { Injectable } from "@nestjs/common";
import { ConfigService as NestConfigService } from "@nestjs/config";
import { AppConfig } from "./app.config";

@Injectable()
export class AppConfigService {
  constructor(private configService: NestConfigService) {}

  get database() {
    return this.configService.get<AppConfig["database"]>("database");
  }

  get clerk() {
    return this.configService.get<AppConfig["clerk"]>("clerk");
  }

  get stripe() {
    return this.configService.get<AppConfig["stripe"]>("stripe");
  }

  get port(): number {
    return this.configService.get<number>("port") || 3001;
  }

  get nodeEnv(): string {
    return this.configService.get<string>("nodeEnv") || "development";
  }

  isDevelopment(): boolean {
    return this.nodeEnv === "development";
  }

  isProduction(): boolean {
    return this.nodeEnv === "production";
  }
}
