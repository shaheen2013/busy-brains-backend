import { Module } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { ClerkGuard } from "./guards/clerk.guard";
import { GoogleAuthController } from "./google-auth.controller";
import { SsoAuthController } from "./sso-auth.controller";
import { SsoAuthService } from "./sso-auth.service";
import { UsersModule } from "../users/users.module";
import { PaymentModule } from "../payment/payment.module";
import { KitModule } from "../kit/kit.module";

@Module({
  imports: [UsersModule, PaymentModule, KitModule],
  controllers: [GoogleAuthController, SsoAuthController],
  providers: [AuthService, ClerkGuard, SsoAuthService],
  exports: [AuthService, ClerkGuard, SsoAuthService],
})
export class AuthModule {}
