import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "../users/entities/user.entity";
import { WeeklySubscription } from "../subscriptions/entities/weekly-subscription.entity";
import { WeeklyPaymentHistory } from "../subscriptions/entities/weekly-payment-history.entity";
import { VerificationToken } from "../users/entities/verification-token.entity";
import { VerificationService } from "../users/verification.service";
import { KitModule } from "../kit/kit.module";
import { PaymentMethodService } from "./payment-method.service";
import { PaymentMethodController } from "./payment-method.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      WeeklySubscription,
      WeeklyPaymentHistory,
      VerificationToken,
    ]),
    KitModule,
  ],
  controllers: [PaymentMethodController],
  providers: [PaymentMethodService, VerificationService],
  exports: [PaymentMethodService],
})
export class PaymentMethodModule {}
