import { Module } from '@nestjs/common';
import { ClerkWebhookController } from './clerk.controller';
import { StripeWebhookController } from './stripe.controller';
import { WebhooksService } from './webhooks.service';

@Module({
  controllers: [ClerkWebhookController, StripeWebhookController],
  providers: [WebhooksService],
})
export class WebhooksModule {}
