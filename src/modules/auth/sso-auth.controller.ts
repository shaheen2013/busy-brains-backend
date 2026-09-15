import { Controller, Get, Query, Res, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Response } from "express";
import { AppConfig } from "../../config/app.config";
import { Public } from "./decorators/public.decorator";
import { SsoAuthService } from "./sso-auth.service";
import { SsoCallbackDto } from "./dtos/sso-callback.dto";

@ApiTags("Auth")
@Controller("auth")
export class SsoAuthController {
  private readonly logger = new Logger(SsoAuthController.name);
  private readonly frontendUrl: string;

  constructor(
    private configService: ConfigService<AppConfig>,
    private ssoAuthService: SsoAuthService,
  ) {
    this.frontendUrl =
      this.configService.get("frontendUrl", { infer: true }) ||
      "http://localhost:3000";
  }

  @Public()
  @Get("callback")
  @ApiOperation({
    summary: "Handle HR SSO callback with access_token",
    description:
      "Validates access_token against HR SSO portal, establishes user session, and redirects to frontend",
  })
  @ApiResponse({
    status: 302,
    description:
      "Redirects to /sso-callback with ticket token on success or /sign-in on failure",
  })
  async handleCallback(@Query() query: SsoCallbackDto, @Res() res: Response) {
    const token = query.access_token || query.token;
    this.logger.log("Received SSO callback request");

    const result = await this.ssoAuthService.verifyAndAuthenticate(token);

    if (result.success && result.ticket) {
      this.logger.log(
        "SSO authentication successful, redirecting to frontend callback",
      );
      return res.redirect(
        `${this.frontendUrl}/sso-callback?token=${result.ticket}`,
      );
    }

    this.logger.warn(
      `SSO authentication failed: ${result.message || "Unknown error"}`,
    );
    return res.redirect(`${this.frontendUrl}/sign-in?error=sso_failed`);
  }

  @Public()
  @Get("sso/callback")
  @ApiOperation({
    summary: "Alias route for HR SSO callback",
  })
  async handleSsoCallbackAlias(
    @Query() query: SsoCallbackDto,
    @Res() res: Response,
  ) {
    return this.handleCallback(query, res);
  }
}
