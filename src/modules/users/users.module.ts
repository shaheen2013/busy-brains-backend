import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "./entities/user.entity";
import { UserPlan } from "../subscriptions/entities/user-plan.entity";
import { UsersService } from "./users.service";
import { UsersController } from "./users.controller";
import { StorageModule } from "../storage/storage.module";
import { EmailModule } from "../email/email.module";
import { VerificationService } from "./verification.service";
import { VerificationToken } from "./entities/verification-token.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserPlan, VerificationToken]),
    StorageModule,
    EmailModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, VerificationService],
  exports: [UsersService],
})
export class UsersModule {}
