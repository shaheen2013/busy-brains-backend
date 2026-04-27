import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Child } from "./entities/child.entity";
import { UserPlan } from "../subscriptions/entities/user-plan.entity";
import { ChildrenService } from "./children.service";
import { ChildrenController } from "./children.controller";

@Module({
  imports: [TypeOrmModule.forFeature([Child, UserPlan])],
  controllers: [ChildrenController],
  providers: [ChildrenService],
})
export class ChildrenModule {}
