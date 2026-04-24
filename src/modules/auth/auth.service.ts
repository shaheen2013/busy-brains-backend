import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  createClerkClient,
  verifyToken as clerkVerifyToken,
  ClerkClient,
} from "@clerk/backend";
import { AppConfig } from "../../config/app.config";

@Injectable()
export class AuthService {
  private readonly clerkClient: ClerkClient;

  constructor(private configService: ConfigService<AppConfig>) {
    const secretKey = this.configService.get("clerk.secretKey", {
      infer: true,
    });

    if (!secretKey) {
      throw new Error("CLERK_SECRET_KEY is missing");
    }

    this.clerkClient = createClerkClient({ secretKey });
  }

  async verifyToken(token: string) {
    try {
      const secretKey = this.configService.get("clerk.secretKey", {
        infer: true,
      });

      if (!secretKey) {
        throw new UnauthorizedException("Clerk not configured");
      }

      const result = await clerkVerifyToken(token, {
        secretKey,
      });

      return result;
    } catch (err) {
      Logger.log(err);
      throw new UnauthorizedException("Invalid token");
    }
  }

  getClerkClient() {
    return this.clerkClient;
  }
}
