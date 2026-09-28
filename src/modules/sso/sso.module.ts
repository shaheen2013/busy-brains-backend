import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { UsersModule } from "../users/users.module";
import { SsoService } from "./sso.service";
import { SsoController } from "./sso.controller";

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [SsoController],
  providers: [SsoService],
})
export class SsoModule {}
