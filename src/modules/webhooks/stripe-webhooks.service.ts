import { Injectable, Logger } from "@nestjs/common";

@Injectable()
export class StripeWebhooksService {
  private logger = new Logger(StripeWebhooksService.name);

  async handleCheckoutCompleted(event: unknown) {
    const obj = (event as { data?: { object?: { id?: string } } }).data?.object;
    this.logger.log(`checkout.session.completed: ${obj?.id}`);
    // TODO: Process payment and create subscription
  }

  async handleInvoicePaymentSucceeded(event: unknown) {
    const obj = (event as { data?: { object?: { id?: string } } }).data?.object;
    this.logger.log(`invoice.payment_succeeded: ${obj?.id}`);
    // TODO: Update subscription status
  }

  async handleInvoicePaymentFailed(event: unknown) {
    const obj = (event as { data?: { object?: { id?: string } } }).data?.object;
    this.logger.log(`invoice.payment_failed: ${obj?.id}`);
    // TODO: Handle payment failure
  }

  async handleCustomerSubscriptionUpdated(event: unknown) {
    const obj = (event as { data?: { object?: { id?: string } } }).data?.object;
    this.logger.log(`customer.subscription.updated: ${obj?.id}`);
    // TODO: Update subscription in database
  }
}
