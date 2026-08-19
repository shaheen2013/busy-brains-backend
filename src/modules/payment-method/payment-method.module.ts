import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "../users/entities/user.entity";
import { WeeklySubscription } from "../subscriptions/entities/weekly-subscription.entity";
import { WeeklyPaymentHistory } from "../subscriptions/entities/weekly-payment-history.entity";
import { PaymentMethodService } from "./payment-method.service";
import { PaymentMethodController } from "./payment-method.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([User, WeeklySubscription, WeeklyPaymentHistory]),
  ],
  controllers: [PaymentMethodController],
  providers: [PaymentMethodService],
  exports: [PaymentMethodService],
})
export class PaymentMethodModule {}
