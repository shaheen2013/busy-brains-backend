import { Controller, Get, Query, Res, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Response } from "express";
import { OAuth2Client } from "google-auth-library";
import { createClerkClient } from "@clerk/backend";
import { AppConfig } from "../../config/app.config";
import { Public } from "./decorators/public.decorator";
import { UsersService } from "../users/users.service";
import { PaymentService } from "../payment/payment.service";
import { KitService } from "../kit/kit.service";

@Controller("auth/google")
export class GoogleAuthController {
  private readonly logger = new Logger(GoogleAuthController.name);
  private readonly oauth2Client: OAuth2Client;
  private readonly clerkClient: ReturnType<typeof createClerkClient>;
  private readonly frontendUrl: string;
  private readonly startTrialOnSignup: boolean;

  constructor(
    private configService: ConfigService<AppConfig>,
    private usersService: UsersService,
    private paymentService: PaymentService,
    private kitService: KitService,
  ) {
    const clientId = this.configService.get("google.clientId", { infer: true });
    const clientSecret = this.configService.get("google.clientSecret", {
      infer: true,
    });
    this.frontendUrl =
      this.configService.get("frontendUrl", { infer: true }) ||
      "http://localhost:3000";

    const callbackUrl = `${this.configService.get("backendUrl", { infer: true }) || "http://localhost:3001"}/auth/google/callback`;

    this.oauth2Client = new OAuth2Client(clientId, clientSecret, callbackUrl);

    const secretKey = this.configService.get("clerk.secretKey", {
      infer: true,
    });
    this.clerkClient = createClerkClient({ secretKey });

    this.startTrialOnSignup = this.configService.get(
      "features.startTrialOnSignup",
      { infer: true },
    );
  }

  @Public()
  @Get()
  redirectToGoogle(@Res() res: Response) {
    const url = this.oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: ["email", "profile"],
      prompt: "select_account",
    });
    res.redirect(url);
  }

  @Public()
  @Get("callback")
  async handleCallback(
    @Query("code") code: string,
    @Query("error") error: string,
    @Res() res: Response,
  ) {
    if (error || !code) {
      this.logger.warn(`Google OAuth error: ${error}`);
      return res.redirect(`${this.frontendUrl}/sign-in?error=google_cancelled`);
    }

    try {
      // Exchange code for tokens
      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);

      // Get user info from Google
      const userInfoRes = await this.oauth2Client.request<{
        id: string;
        email: string;
        name: string;
        given_name: string;
        family_name: string;
        picture: string;
      }>({ url: "https://www.googleapis.com/oauth2/v2/userinfo" });

      const googleUser = userInfoRes.data;
      const displayName = googleUser.given_name
        ? `${googleUser.given_name} ${googleUser.family_name || ""}`.trim()
        : googleUser.name;

      this.logger.log(`Google user: ${googleUser.email}`);

      // Find or create Clerk user
      let clerkUserId: string;
      const existingUsers = await this.clerkClient.users.getUserList({
        emailAddress: [googleUser.email],
      });

      if (existingUsers.totalCount > 0) {
        clerkUserId = existingUsers.data[0].id;
        this.logger.log(`Found existing Clerk user: ${clerkUserId}`);
      } else {
        const newClerkUser = await this.clerkClient.users.createUser({
          emailAddress: [googleUser.email],
          firstName: googleUser.given_name || googleUser.name,
          lastName: googleUser.family_name || "",
          skipPasswordRequirement: true,
        });
        clerkUserId = newClerkUser.id;
        this.logger.log(`Created Clerk user: ${clerkUserId}`);
      }

      // Ensure user exists in DB (webhook may not have fired yet for Google sign-ins)
      const { user: dbUser, isNew } =
        await this.usersService.findOrCreateFromOAuth({
          clerkId: clerkUserId,
          email: googleUser.email,
          name: displayName,
        });

      if (isNew) {
        this.logger.log(`Created DB user: ${clerkUserId}`);
        if (this.startTrialOnSignup) {
          try {
            await this.paymentService.startTrial(dbUser);
            this.logger.log(`Trial started for user: ${clerkUserId}`);
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

      // Create a one-time sign-in token (valid 2 minutes)
      const signInToken = await this.clerkClient.signInTokens.createSignInToken(
        { userId: clerkUserId, expiresInSeconds: 120 },
      );

      return res.redirect(
        `${this.frontendUrl}/google-callback?token=${signInToken.token}`,
      );
    } catch (err: any) {
      this.logger.error(
        `Google OAuth callback failed: ${err.message}`,
        err.stack,
      );
      return res.redirect(`${this.frontendUrl}/sign-in?error=google_failed`);
    }
  }
}
