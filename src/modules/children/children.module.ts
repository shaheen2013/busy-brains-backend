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

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Child,
      UserPlan,
      ChildModule,
      ChildQuest,
      ChildScreen,
    ]),
    StorageModule,
  ],
  controllers: [ChildrenController],
  providers: [ChildrenService],
})
export class ChildrenModule {}
