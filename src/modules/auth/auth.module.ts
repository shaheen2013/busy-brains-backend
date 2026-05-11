import { Module } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { ClerkGuard } from "./guards/clerk.guard";
import { GoogleAuthController } from "./google-auth.controller";
import { UsersModule } from "../users/users.module";
import { PaymentModule } from "../payment/payment.module";

@Module({
  imports: [UsersModule, PaymentModule],
  controllers: [GoogleAuthController],
  providers: [AuthService, ClerkGuard],
  exports: [AuthService, ClerkGuard],
})
export class AuthModule {}
