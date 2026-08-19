import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { WeeklyPlan } from "../subscriptions/entities/weekly-plan.entity";
import { WeeklySubscription } from "../subscriptions/entities/weekly-subscription.entity";
import { WeeklyPaymentHistory } from "../subscriptions/entities/weekly-payment-history.entity";
import { User } from "../users/entities/user.entity";
import { WeeklySubscriptionService } from "./weekly-subscription.service";
import { WeeklySubscriptionController } from "./weekly-subscription.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WeeklyPlan,
      WeeklySubscription,
      WeeklyPaymentHistory,
      User,
    ]),
  ],
  controllers: [WeeklySubscriptionController],
  providers: [WeeklySubscriptionService],
  exports: [WeeklySubscriptionService],
})
export class WeeklySubscriptionModule {}
