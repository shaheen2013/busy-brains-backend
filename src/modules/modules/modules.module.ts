import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UserPlan } from "../subscriptions/entities/user-plan.entity";
import { Child } from "../children/entities/child.entity";
import { ChildModule as ChildModuleEntity } from "../children/entities/child-module.entity";
import { ChildQuest } from "../children/entities/child-quest.entity";
import { ChildScreen } from "../children/entities/child-screen.entity";
import { ModulesService } from "./modules.service";
import { ModulesController } from "./modules.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserPlan,
      Child,
      ChildModuleEntity,
      ChildQuest,
      ChildScreen,
    ]),
  ],
  controllers: [ModulesController],
  providers: [ModulesService],
})
export class ModulesModule {}
