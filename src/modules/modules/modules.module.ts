import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UserPlan } from "../subscriptions/entities/user-plan.entity";
import { ModulesService } from "./modules.service";
import { ModulesController } from "./modules.controller";

@Module({
  imports: [TypeOrmModule.forFeature([UserPlan])],
  controllers: [ModulesController],
  providers: [ModulesService],
})
export class ModulesModule {}
