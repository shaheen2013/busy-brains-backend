import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Plan } from "../subscriptions/entities/plan.entity";
import { UserPlan } from "../subscriptions/entities/user-plan.entity";
import { PaymentService } from "./payment.service";
import { PaymentController } from "./payment.controller";

@Module({
  imports: [TypeOrmModule.forFeature([Plan, UserPlan])],
  controllers: [PaymentController],
  providers: [PaymentService],
})
export class PaymentModule {}
