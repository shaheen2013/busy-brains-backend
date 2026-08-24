import { Injectable, Logger } from "@nestjs/common";
import { PaymentService } from "../payment/payment.service";
import { KitService } from "../kit/kit.service";
import { WeeklySubscriptionService } from "../weekly-subscription/weekly-subscription.service";
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

  constructor(
    private readonly paymentService: PaymentService,
    private readonly kitService: KitService,
    private readonly weeklySubscriptionService: WeeklySubscriptionService,
  ) {}

  async handleCheckoutCompleted(event: any) {
    const session = (event as CheckoutSessionCompletedEvent).data.object as any;
    const { userId, planName, type } = session.metadata ?? {};

    if (type === "weekly_start") {
      await this.weeklySubscriptionService.handleStartCheckoutCompleted(
        session,
      );
      this.logger.log(`weekly_start checkout completed: ${session.id}`);
      return;
    }
    if (type === "weekly_upgrade") {
      await this.weeklySubscriptionService.handleUpgradeCheckoutCompleted(
        session,
      );
      this.logger.log(`weekly_upgrade checkout completed: ${session.id}`);
      return;
    }
    if (type === "weekly_payoff") {
      await this.weeklySubscriptionService.handlePayoffCheckoutCompleted(
        session,
      );
      this.logger.log(`weekly_payoff checkout completed: ${session.id}`);
      return;
    }

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
      promotionCodeId: session.discounts?.[0]?.promotion_code ?? null,
    });

    this.logger.log(
      `Checkout completed for user ${userId}: ${planName} (${session.id})`,
    );

    if (session.metadata?.isUpgrade !== "true") {
      await this.kitService.subscribeToSequence(userId);
    }
  }

  async handlePaymentIntentSucceeded(event: any) {
    const pi = (event as PaymentIntentSucceededEvent).data.object;
    await this.paymentService.handlePaymentIntentSucceeded(
      pi.id,
      pi.amount,
      pi.currency,
    );
  }

  async handlePaymentIntentFailed(event: any) {
    const pi = (event as PaymentIntentPaymentFailedEvent).data.object;
    await this.paymentService.handlePaymentIntentFailed(pi.id);
  }

  /**
   * Newer Stripe API versions moved invoice.subscription to
   * invoice.parent.subscription_details.subscription — check both shapes so
   * this keeps working across API version changes.
   */
  private resolveInvoiceSubscriptionId(invoice: any): string | null {
    const legacy = invoice.subscription;
    if (legacy) return typeof legacy === "string" ? legacy : legacy.id;

    const viaParent = invoice.parent?.subscription_details?.subscription;
    if (viaParent)
      return typeof viaParent === "string" ? viaParent : viaParent.id;

    return null;
  }

  async handleInvoicePaymentSucceeded(event: any) {
    const invoice = (event as InvoicePaymentSucceededEvent).data.object as any;
    const subscriptionId = this.resolveInvoiceSubscriptionId(invoice);

    if (subscriptionId) {
      await this.weeklySubscriptionService.handleInvoicePaymentSucceeded(
        subscriptionId,
        invoice.id,
        invoice.amount_paid ?? 0,
        invoice.currency ?? "aud",
        invoice.invoice_pdf ?? null,
      );
      this.logger.log(`invoice.payment_succeeded (weekly): ${invoice.id}`);
      return;
    }

    await this.paymentService.handleInvoicePaid(
      invoice.id,
      invoice.invoice_pdf,
    );
    this.logger.log(`invoice.payment_succeeded: ${invoice.id}`);
  }

  async handleInvoicePaymentFailed(event: any) {
    const invoice = (event as InvoicePaymentFailedEvent).data.object as any;
    const subscriptionId = this.resolveInvoiceSubscriptionId(invoice);

    if (subscriptionId) {
      const failureReason =
        invoice.last_finalization_error?.message ??
        invoice.payment_intent?.last_payment_error?.message ??
        null;
      await this.weeklySubscriptionService.handleInvoicePaymentFailed(
        subscriptionId,
        invoice.id,
        invoice.amount_due ?? 0,
        invoice.currency ?? "aud",
        failureReason,
      );
    }

    this.logger.log(`invoice.payment_failed: ${invoice.id}`);
  }

  async handleSubscriptionUpdated(event: any) {
    const subscription = event.data.object;
    // Newer Stripe API versions moved current_period_end off the top-level
    // subscription object onto its first item — same shift as invoice.subscription.
    const rawPeriodEnd =
      subscription.current_period_end ??
      subscription.items?.data?.[0]?.current_period_end;
    const currentPeriodEnd = rawPeriodEnd
      ? new Date(rawPeriodEnd * 1000)
      : null;
    await this.weeklySubscriptionService.handleSubscriptionUpdated(
      subscription.id,
      subscription.status,
      currentPeriodEnd,
    );
    this.logger.log(
      `customer.subscription.updated: ${subscription.id} (${subscription.status})`,
    );
  }

  async handleSubscriptionDeleted(event: any) {
    const subscription = event.data.object;
    await this.weeklySubscriptionService.handleSubscriptionDeleted(
      subscription.id,
    );
    this.logger.log(`customer.subscription.deleted: ${subscription.id}`);
  }
}
