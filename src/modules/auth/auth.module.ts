import { Module } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { ClerkGuard } from "./guards/clerk.guard";
import { UsersModule } from "../users/users.module";

@Module({
  imports: [UsersModule],
  providers: [AuthService, ClerkGuard],
  exports: [AuthService, ClerkGuard],
})
export class AuthModule {}
