import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ParentResourcesController } from "./parent-resources.controller";
import { ParentResourcesService } from "./parent-resources.service";
import { UserPlan } from "../subscriptions/entities/user-plan.entity";
import { Child } from "../children/entities/child.entity";
import { ChildModule } from "../children/entities/child-module.entity";

@Module({
  imports: [TypeOrmModule.forFeature([UserPlan, Child, ChildModule])],
  controllers: [ParentResourcesController],
  providers: [ParentResourcesService],
})
export class ParentResourcesModule {}
