import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClerkClient } from "@clerk/backend";
import { AppConfig } from "../../config/app.config";
import { UsersService } from "../users/users.service";
import { PaymentService } from "../payment/payment.service";
import { KitService } from "../kit/kit.service";

export interface SsoAuthResult {
  success: boolean;
  ticket?: string;
  message?: string;
  user?: {
    email: string;
    role?: string;
    name?: string;
  };
}

@Injectable()
export class SsoAuthService {
  private readonly logger = new Logger(SsoAuthService.name);
  private readonly clerkClient: ReturnType<typeof createClerkClient>;
  private readonly verifyUrl: string;
  private readonly mockSso: boolean;
  private readonly defaultEmail: string;
  private readonly defaultName: string;
  private readonly startTrialOnSignup: boolean;

  constructor(
    private configService: ConfigService<AppConfig>,
    private usersService: UsersService,
    private paymentService: PaymentService,
    private kitService: KitService,
  ) {
    this.verifyUrl =
      this.configService.get("sso.verifyUrl", { infer: true }) ||
      "https://hr.mediusware.xyz/api/verify_token";
    this.mockSso = this.configService.get("sso.mock", { infer: true }) || false;
    this.defaultEmail =
      this.configService.get("sso.defaultEmail", { infer: true }) ||
      "admin@example.com";
    this.defaultName =
      this.configService.get("sso.defaultName", { infer: true }) || "Admin";

    const secretKey = this.configService.get("clerk.secretKey", {
      infer: true,
    });
    this.clerkClient = createClerkClient({ secretKey });

    this.startTrialOnSignup =
      this.configService.get("features.startTrialOnSignup", {
        infer: true,
      }) || false;
  }

  async verifyAndAuthenticate(token?: string): Promise<SsoAuthResult> {
    // 1. Mock SSO flow for local development
    if (this.mockSso) {
      this.logger.log(
        `Mock SSO is active. Authenticating default user: ${this.defaultEmail}`,
      );
      return this.authenticateUser(
        this.defaultEmail,
        this.defaultName,
        "admin",
      );
    }

    // 2. Token validation
    if (!token || !token.trim()) {
      this.logger.warn("SSO authentication failed: missing access token");
      return {
        success: false,
        message: "Missing access token",
      };
    }

    try {
      // 3. Remote token verification request
      const response = await fetch(this.verifyUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          access_token: token,
        }),
      });

      const body = (await response.json().catch(() => null)) as {
        success?: boolean;
        status?: string;
        message?: string;
        data?: {
          user?: {
            email?: string;
            role?: string;
            name?: string;
          };
        };
      } | null;

      if (
        response.ok &&
        body &&
        (body.success === true || body.status === "success")
      ) {
        const userEmail: string = body.data?.user?.email || this.defaultEmail;
        const userRole: string = body.data?.user?.role || "admin";
        const userName: string =
          body.data?.user?.name ||
          (userRole
            ? userRole.charAt(0).toUpperCase() + userRole.slice(1)
            : this.defaultName);

        this.logger.log(`SSO verification successful for: ${userEmail}`);
        return this.authenticateUser(userEmail, userName, userRole);
      }

      this.logger.warn(
        `SSO verification failed with status ${response.status}: ${body?.message || "Invalid or expired token"}`,
      );
      return {
        success: false,
        message: body?.message || "Invalid or expired token",
      };
    } catch (err: any) {
      this.logger.error(
        `SSO verification request error: ${err.message}`,
        err.stack,
      );
      return {
        success: false,
        message: "Verification service temporarily unavailable",
      };
    }
  }

  private async authenticateUser(
    email: string,
    name: string,
    role: string,
  ): Promise<SsoAuthResult> {
    try {
      // Find or create Clerk user
      let clerkUserId: string;
      const existingUsers = await this.clerkClient.users.getUserList({
        emailAddress: [email],
      });

      if (existingUsers.totalCount > 0) {
        clerkUserId = existingUsers.data[0].id;
        this.logger.log(`Found existing Clerk user: ${clerkUserId}`);
      } else {
        const newClerkUser = await this.clerkClient.users.createUser({
          emailAddress: [email],
          firstName: name,
          lastName: "",
          skipPasswordRequirement: true,
        });
        clerkUserId = newClerkUser.id;
        this.logger.log(`Created Clerk user: ${clerkUserId}`);
      }

      // Ensure user exists in database
      const { user: dbUser, isNew } =
        await this.usersService.findOrCreateFromOAuth({
          clerkId: clerkUserId,
          email,
          name,
        });

      if (isNew) {
        this.logger.log(`Created DB user: ${clerkUserId}`);
        if (this.startTrialOnSignup) {
          try {
            await this.paymentService.startTrial(dbUser);
          } catch (trialErr: any) {
            this.logger.error(
              `Failed to start trial for ${clerkUserId}: ${trialErr.message}`,
            );
          }
        }
        try {
          await this.kitService.subscribeToSignupSequence(dbUser.id);
        } catch (kitErr: any) {
          this.logger.error(
            `Failed to subscribe ${clerkUserId} to Kit signup sequence: ${kitErr.message}`,
          );
        }
      }

      // Create a one-time sign-in token (valid for 120 seconds)
      const signInToken = await this.clerkClient.signInTokens.createSignInToken(
        {
          userId: clerkUserId,
          expiresInSeconds: 120,
        },
      );

      return {
        success: true,
        ticket: signInToken.token,
        user: {
          email,
          name,
          role,
        },
      };
    } catch (err: any) {
      this.logger.error(
        `Failed to provision user session for ${email}: ${err.message}`,
        err.stack,
      );
      return {
        success: false,
        message: "Failed to create user session",
      };
    }
  }
}
