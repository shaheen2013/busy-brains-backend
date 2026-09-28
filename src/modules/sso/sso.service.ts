import {
  Injectable,
  Logger,
  BadRequestException,
  UnauthorizedException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppConfig } from "../../config/app.config";
import { AuthService } from "../auth/auth.service";
import { UsersService } from "../users/users.service";

interface HrSsoPayload {
  email: string | null;
  name: string;
}

@Injectable()
export class SsoService {
  private readonly logger = new Logger(SsoService.name);

  constructor(
    private configService: ConfigService<AppConfig>,
    private authService: AuthService,
    private usersService: UsersService,
  ) {}

  /**
   * Verifies the single-use SSO token/demo code against the HR portal, or
   * mocks the result locally when MOCK_SSO is enabled.
   */
  async verifySsoToken(token: string): Promise<HrSsoPayload> {
    const sso = this.configService.get("sso", { infer: true });

    if (sso.mock) {
      this.logger.log(
        `[SSO] MOCK_SSO is active. Simulating successful verification for ${sso.demoEmail}`,
      );
      return { email: sso.demoEmail, name: sso.demoName };
    }

    // Step 1: primary demo-validate endpoint, no auth header.
    if (sso.demoValidateUrl) {
      try {
        const response = await fetch(sso.demoValidateUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ code: token, domain: sso.domain }),
        });
        const body = await response.json().catch(() => null);

        if (response.ok && body?.success) {
          return this.extractPayload(body.data);
        }

        this.logger.warn(
          `[SSO] Demo validate failed, falling back to cross-domain verify: ${JSON.stringify(body)}`,
        );
      } catch (err: any) {
        this.logger.warn(
          `[SSO] Demo validate endpoint error, falling back to cross-domain verify: ${err.message}`,
        );
      }
    }

    // Step 2 fallback: cross-domain endpoint, bearer-authenticated.
    try {
      const response = await fetch(sso.verifyUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code: token, domain: sso.domain }),
      });
      const body = await response.json().catch(() => null);

      if (!response.ok || !body?.success) {
        const message = body?.error?.message || body?.message || "Invalid or expired demo code";
        this.logger.warn(`[SSO] Cross-domain verification failed: ${message}`);
        throw new UnauthorizedException(message);
      }

      return this.extractPayload(body.data);
    } catch (err) {
      if (err instanceof UnauthorizedException || err instanceof BadRequestException) {
        throw err;
      }
      this.logger.error(`[SSO] Error contacting verification service: ${err.message}`);
      throw new ServiceUnavailableException("Verification service temporarily unavailable");
    }
  }

  /**
   * Verifies the token, then signs the visitor into the single seeded demo
   * account and returns a Clerk sign-in ticket (same pattern as the Google
   * OAuth callback's clerkClient.signInTokens.createSignInToken usage).
   */
  async exchangeForSignInTicket(token: string): Promise<{ ticket: string }> {
    await this.verifySsoToken(token);

    const sso = this.configService.get("sso", { infer: true });
    const clerkClient = this.authService.getClerkClient();

    let clerkUserId: string;
    const existingUsers = await clerkClient.users.getUserList({
      emailAddress: [sso.demoEmail],
    });

    if (existingUsers.totalCount > 0) {
      clerkUserId = existingUsers.data[0].id;
    } else {
      const newClerkUser = await clerkClient.users.createUser({
        emailAddress: [sso.demoEmail],
        firstName: sso.demoName,
        skipPasswordRequirement: true,
      });
      clerkUserId = newClerkUser.id;
      this.logger.log(`[SSO] Created demo Clerk user: ${clerkUserId}`);
    }

    // Ensure the local DB row exists (webhook may not have fired yet).
    await this.usersService.findOrCreateFromOAuth({
      clerkId: clerkUserId,
      email: sso.demoEmail,
      name: sso.demoName,
    });

    const signInToken = await clerkClient.signInTokens.createSignInToken({
      userId: clerkUserId,
      expiresInSeconds: 120,
    });

    return { ticket: signInToken.token };
  }

  private extractPayload(data: Record<string, unknown> | null | undefined): HrSsoPayload {
    if (!data) {
      throw new BadRequestException("Invalid or expired demo code");
    }

    return {
      email: typeof data.email === "string" ? data.email : null,
      name:
        (typeof data.name === "string" && data.name) ||
        (typeof data.project_name === "string" && data.project_name) ||
        "Demo User",
    };
  }
}
