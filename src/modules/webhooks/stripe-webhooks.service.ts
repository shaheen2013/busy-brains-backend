import { Injectable, Logger } from "@nestjs/common";
import { PaymentService } from "../payment/payment.service";
import type {
  CheckoutSessionCompletedEvent,
  PaymentIntentSucceededEvent,
  PaymentIntentPaymentFailedEvent,
  InvoicePaymentSucceededEvent,
  InvoicePaymentFailedEvent,
} from "../../types/Stripe-events";

@Injectable()
export class StripeWebhooksService {
  private logger = new Logger(StripeWebhooksService.name);

  constructor(private readonly paymentService: PaymentService) {}

  async handleCheckoutCompleted(event: any) {
    const session = (event as CheckoutSessionCompletedEvent).data.object;
    const { userId, planName } = session.metadata ?? {};

    if (!userId || !planName) {
      this.logger.warn(
        `checkout.session.completed missing metadata: ${session.id}`,
      );
      return;
    }

    await this.paymentService.handleCheckoutCompleted(userId, planName, {
      id: session.id,
      payment_intent: session.payment_intent,
      amount_total: session.amount_total,
      currency: session.currency,
    });

    this.logger.log(
      `Checkout completed for user ${userId}: ${planName} (${session.id})`,
    );
  }

  async handlePaymentIntentSucceeded(event: any) {
    const pi = (event as PaymentIntentSucceededEvent).data.object;
    await this.paymentService.handlePaymentIntentSucceeded(pi.id);
    this.logger.log(`payment_intent.succeeded: ${pi.id}`);
  }

  async handlePaymentIntentFailed(event: any) {
    const pi = (event as PaymentIntentPaymentFailedEvent).data.object;
    await this.paymentService.handlePaymentIntentFailed(pi.id);
    this.logger.log(`payment_intent.payment_failed: ${pi.id}`);
  }

  async handleInvoicePaymentSucceeded(event: any) {
    const invoice = (event as InvoicePaymentSucceededEvent).data.object;
    await this.paymentService.handleInvoicePaid(
      invoice.id,
      invoice.invoice_pdf,
    );
    this.logger.log(`invoice.payment_succeeded: ${invoice.id}`);
  }

  async handleInvoicePaymentFailed(event: any) {
    const invoice = (event as InvoicePaymentFailedEvent).data.object;
    this.logger.log(`invoice.payment_failed: ${invoice.id}`);
  }
}
