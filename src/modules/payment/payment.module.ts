import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Plan } from "../subscriptions/entities/plan.entity";
import { UserPlan } from "../subscriptions/entities/user-plan.entity";
import { PaymentHistory } from "../subscriptions/entities/payment-history.entity";
import { PaymentService } from "./payment.service";
import { PaymentController } from "./payment.controller";
import { User } from "../users/entities/user.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Plan, UserPlan, PaymentHistory, User])],
  controllers: [PaymentController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
