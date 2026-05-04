import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ParentResourcesController } from "./parent-resources.controller";
import { ParentResourcesService } from "./parent-resources.service";
import { UserPlan } from "../subscriptions/entities/user-plan.entity";

@Module({
  imports: [TypeOrmModule.forFeature([UserPlan])],
  controllers: [ParentResourcesController],
  providers: [ParentResourcesService],
})
export class ParentResourcesModule {}
