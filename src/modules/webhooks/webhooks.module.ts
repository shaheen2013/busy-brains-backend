import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "../users/entities/user.entity";
import { ClerkWebhookController } from "./clerk.controller";
import { StripeWebhookController } from "./stripe.controller";
import { ClerkWebhooksService } from "./clerk-webhooks.service";
import { StripeWebhooksService } from "./stripe-webhooks.service";
import { PaymentModule } from "../payment/payment.module";
import { KitModule } from "../kit/kit.module";
import { WeeklySubscriptionModule } from "../weekly-subscription/weekly-subscription.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    PaymentModule,
    KitModule,
    WeeklySubscriptionModule,
  ],
  controllers: [ClerkWebhookController, StripeWebhookController],
  providers: [ClerkWebhooksService, StripeWebhooksService],
})
export class WebhooksModule {}
