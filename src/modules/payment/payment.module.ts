import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Plan } from "../subscriptions/entities/plan.entity";
import { UserPlan } from "../subscriptions/entities/user-plan.entity";
import { PaymentHistory } from "../subscriptions/entities/payment-history.entity";
import { WeeklyPaymentHistory } from "../subscriptions/entities/weekly-payment-history.entity";
import { PaymentService } from "./payment.service";
import { PaymentController } from "./payment.controller";
import { User } from "../users/entities/user.entity";
import { WeeklySubscriptionModule } from "../weekly-subscription/weekly-subscription.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Plan,
      UserPlan,
      PaymentHistory,
      WeeklyPaymentHistory,
      User,
    ]),
    forwardRef(() => WeeklySubscriptionModule),
  ],
  controllers: [PaymentController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
