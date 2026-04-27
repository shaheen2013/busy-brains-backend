import { Injectable, Logger } from "@nestjs/common";
import { PlanName } from "../subscriptions/entities/plan.entity";
import { PaymentService } from "../payment/payment.service";
import { CheckoutSessionCompletedEvent, InvoicePaymentFailedEvent, InvoicePaymentSucceededEvent } from "../../types/StripeEvents";



@Injectable()
export class StripeWebhooksService {
  private logger = new Logger(StripeWebhooksService.name);

  constructor(private readonly paymentService: PaymentService) {}

  async handleCheckoutCompleted(event: any) {
    const sessionEvent: CheckoutSessionCompletedEvent = event;
    const session = sessionEvent.data.object;

    const userId = session.metadata?.userId;
    const planName = session.metadata?.planName as PlanName | undefined;

    if (!userId || !planName) {
      this.logger.warn(
        `checkout.session.completed missing metadata: ${session.id}`,
      );
      return;
    }

    await this.paymentService.activatePlanForUser(userId, planName);

    this.logger.log(
      `Plan activated for user ${userId}: ${planName} (session ${session.id})`,
    );
  }

  async handleInvoicePaymentSucceeded(event: any) {
    const invoiceEvent: InvoicePaymentSucceededEvent = event;
    const invoice = invoiceEvent.data.object;

    this.logger.log(`invoice.payment_succeeded: ${invoice.id}`);
  }

  async handleInvoicePaymentFailed(event: any) {
    const invoiceEvent: InvoicePaymentFailedEvent = event;
    const invoice = invoiceEvent.data.object;

    this.logger.log(`invoice.payment_failed: ${invoice.id}`);
  }
}
