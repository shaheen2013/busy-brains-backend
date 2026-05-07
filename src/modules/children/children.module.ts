import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Child } from "./entities/child.entity";
import { UserPlan } from "../subscriptions/entities/user-plan.entity";
import { ChildrenService } from "./children.service";
import { ChildrenController } from "./children.controller";
import { ChildModule } from "./entities/child-module.entity";
import { ChildQuest } from "./entities/child-quest.entity";
import { ChildScreen } from "./entities/child-screen.entity";
import { StorageModule } from "../storage/storage.module";
import { EmailModule } from "../email/email.module";
import { VerificationToken } from "../users/entities/verification-token.entity";
import { VerificationService } from "../users/verification.service";
import { User } from "../users/entities/user.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Child,
      UserPlan,
      ChildModule,
      ChildQuest,
      ChildScreen,
      VerificationToken,
      User,
    ]),
    StorageModule,
    EmailModule,
  ],
  controllers: [ChildrenController],
  providers: [ChildrenService, VerificationService],
})
export class ChildrenModule {}
