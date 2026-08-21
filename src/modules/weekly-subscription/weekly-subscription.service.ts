import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";
import { In, Repository } from "typeorm";
import Stripe from "stripe";
import { AppConfig } from "../../config/app.config";
import {
  WeeklyPlan,
  WeeklyPlanTier,
} from "../subscriptions/entities/weekly-plan.entity";
import {
  WeeklySubscription,
  WeeklySubscriptionStatus,
} from "../subscriptions/entities/weekly-subscription.entity";
import {
  WeeklyPaymentHistory,
  WeeklyPaymentStatus,
  WeeklyPaymentType,
} from "../subscriptions/entities/weekly-payment-history.entity";
import { User } from "../users/entities/user.entity";
import { VerificationService } from "../users/verification.service";
import { VerificationType } from "../users/entities/verification-token.entity";
import { KitService } from "../kit/kit.service";

const ACTIVE_STATUSES = [
  WeeklySubscriptionStatus.ACTIVE,
  WeeklySubscriptionStatus.PAST_DUE,
];

@Injectable()
export class WeeklySubscriptionService {
  private stripe: Stripe.Stripe;
  private logger = new Logger(WeeklySubscriptionService.name);

  constructor(
    @InjectRepository(WeeklyPlan)
    private readonly weeklyPlanRepository: Repository<WeeklyPlan>,
    @InjectRepository(WeeklySubscription)
    private readonly weeklySubscriptionRepository: Repository<WeeklySubscription>,
    @InjectRepository(WeeklyPaymentHistory)
    private readonly weeklyPaymentHistoryRepository: Repository<WeeklyPaymentHistory>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly configService: ConfigService<AppConfig>,
    private readonly verificationService: VerificationService,
    private readonly kitService: KitService,
  ) {
    const { secretKey } = this.configService.get("stripe", { infer: true });
    if (!secretKey) throw new Error("STRIPE_SECRET_KEY is not configured");
    this.stripe = new Stripe(secretKey, { apiVersion: "2026-04-22.dahlia" });
  }

  private async ensureStripeCustomer(user: User): Promise<string> {
    if (user.stripeCustomerId) return user.stripeCustomerId;
    const customer = await this.stripe.customers.create({
      email: user.email,
      metadata: { userId: user.id },
    });
    user.stripeCustomerId = customer.id;
    await this.userRepository.save(user);
    return customer.id;
  }

  private async getActiveSubscription(
    userId: string,
  ): Promise<WeeklySubscription | null> {
    return this.weeklySubscriptionRepository.findOne({
      where: { userId, status: In(ACTIVE_STATUSES) },
      relations: { weeklyPlan: true },
    });
  }

  /**
   * Every weekly money-moving action (start/upgrade/payoff) goes through
   * Stripe Checkout, same as the one-time plan flow — Stripe hosts card
   * collection/selection, and whichever card is used there becomes the
   * customer's new default payment method (see handle*CheckoutCompleted below).
   */
  async start(
    user: User,
    tier: WeeklyPlanTier,
  ): Promise<{ sessionId: string; url: string }> {
    const existing = await this.getActiveSubscription(user.id);
    if (existing) {
      throw new ConflictException(
        "User already has an active weekly subscription",
      );
    }

    const plan = await this.weeklyPlanRepository.findOne({ where: { tier } });
    if (!plan) throw new NotFoundException(`Weekly plan "${tier}" not found`);

    const stripeCustomerId = await this.ensureStripeCustomer(user);
    const baseUrl = this.configService.get("frontendUrl", { infer: true });

    const session = await this.stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      client_reference_id: user.id,
      customer: stripeCustomerId,
      metadata: {
        type: "weekly_start",
        userId: user.id,
        weeklyPlanId: plan.id,
      },
      // Checkout automatically saves the card used as the new subscription's
      // default payment method — no extra config needed for that part.
      subscription_data: {
        metadata: {
          userId: user.id,
          weeklyPlanId: plan.id,
          totalCycles: String(plan.totalCycles),
        },
      },
      success_url: `${baseUrl}/panel/subscription?complete=true`,
      cancel_url: `${baseUrl}/panel/subscription`,
    });

    return { sessionId: session.id, url: session.url ?? "" };
  }

  async payoff(
    user: User,
    targetTier?: WeeklyPlanTier,
  ): Promise<{ sessionId: string; url: string }> {
    const sub = await this.getActiveSubscription(user.id);
    if (!sub)
      throw new NotFoundException("No active weekly subscription found");

    if (
      targetTier === WeeklyPlanTier.SINGLE &&
      sub.weeklyPlan.tier === WeeklyPlanTier.FAMILY
    ) {
      throw new BadRequestException(
        "Downgrading from Family to Single is not allowed",
      );
    }

    const remainingCycles = sub.totalCycles - sub.cyclesPaid;
    if (remainingCycles <= 0) {
      throw new BadRequestException(
        "Subscription has no remaining cycles to pay off",
      );
    }

    const payoffPlan =
      targetTier && targetTier !== sub.weeklyPlan.tier
        ? await this.weeklyPlanRepository.findOne({
            where: { tier: targetTier },
          })
        : sub.weeklyPlan;
    if (!payoffPlan)
      throw new NotFoundException(`Weekly plan "${targetTier}" not found`);

    const remainingAmount = remainingCycles * payoffPlan.weeklyPrice;
    const stripeCustomerId = await this.ensureStripeCustomer(user);
    const baseUrl = this.configService.get("frontendUrl", { infer: true });

    const session = await this.stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: payoffPlan.currency,
            unit_amount: remainingAmount,
            product_data: {
              name: `Pay in full — ${payoffPlan.tier} 6-Week Journey`,
            },
          },
          quantity: 1,
        },
      ],
      client_reference_id: user.id,
      customer: stripeCustomerId,
      payment_intent_data: { setup_future_usage: "off_session" },
      invoice_creation: { enabled: true },
      metadata: {
        type: "weekly_payoff",
        userId: user.id,
        weeklySubscriptionId: sub.id,
        targetTier: payoffPlan.tier,
      },
      success_url: `${baseUrl}/panel/subscription?complete=true`,
      cancel_url: `${baseUrl}/panel/subscription`,
    });

    return { sessionId: session.id, url: session.url ?? "" };
  }

  async upgrade(user: User): Promise<{ sessionId: string; url: string }> {
    const sub = await this.getActiveSubscription(user.id);
    if (!sub)
      throw new NotFoundException("No active weekly subscription found");
    if (sub.weeklyPlan.tier === WeeklyPlanTier.FAMILY) {
      throw new BadRequestException("Subscription is already Family tier");
    }

    const remainingCycles = sub.totalCycles - sub.cyclesPaid;
    if (remainingCycles <= 0) {
      throw new BadRequestException(
        "Subscription has no remaining cycles to upgrade",
      );
    }

    const familyPlan = await this.weeklyPlanRepository.findOne({
      where: { tier: WeeklyPlanTier.FAMILY },
    });
    if (!familyPlan)
      throw new NotFoundException('Weekly plan "FAMILY" not found');

    // Charge the diff for each cycle already paid at the old (Single) rate —
    // that's the shortfall vs. what they'd owe if they'd been on Family from
    // the start. The price swap (on webhook) makes every future cycle bill at
    // the Family rate automatically, so remaining cycles aren't charged here.
    const { weeklyUpgradeDiffAmount } = this.configService.get("stripe", {
      infer: true,
    });
    const upgradeAmount = sub.cyclesPaid * weeklyUpgradeDiffAmount;

    const stripeCustomerId = await this.ensureStripeCustomer(user);
    const baseUrl = this.configService.get("frontendUrl", { infer: true });

    const session = await this.stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: familyPlan.currency,
            unit_amount: upgradeAmount,
            product_data: {
              name: "Upgrade to Family — catch-up differential",
            },
          },
          quantity: 1,
        },
      ],
      client_reference_id: user.id,
      customer: stripeCustomerId,
      payment_intent_data: { setup_future_usage: "off_session" },
      invoice_creation: { enabled: true },
      metadata: {
        type: "weekly_upgrade",
        userId: user.id,
        weeklySubscriptionId: sub.id,
      },
      success_url: `${baseUrl}/panel/subscription?complete=true`,
      cancel_url: `${baseUrl}/panel/subscription`,
    });

    return { sessionId: session.id, url: session.url ?? "" };
  }

  async requestCancelOtp(user: User): Promise<{ message: string }> {
    const otp = await this.verificationService.generateOtp(
      user.id,
      VerificationType.WEEKLY_SUBSCRIPTION_CANCELLATION,
    );
    await this.kitService.sendWeeklySubscriptionCancelOtp(user.id, otp);
    return { message: "OTP sent to email" };
  }

  async cancel(
    user: User,
    otp: string,
  ): Promise<{ weeklySubscriptionId: string; status: "canceled" }> {
    await this.verificationService.verifyOtp(
      user.id,
      VerificationType.WEEKLY_SUBSCRIPTION_CANCELLATION,
      otp,
    );

    const sub = await this.getActiveSubscription(user.id);
    if (!sub)
      throw new NotFoundException("No active weekly subscription found");

    await this.stripe.subscriptions.cancel(sub.stripeSubscriptionId, {
      prorate: false,
    });

    sub.status = WeeklySubscriptionStatus.CANCELED;
    sub.canceledAt = new Date();
    await this.weeklySubscriptionRepository.save(sub);

    return { weeklySubscriptionId: sub.id, status: "canceled" };
  }

  async getCurrent(userId: string): Promise<WeeklySubscription | null> {
    return this.weeklySubscriptionRepository.findOne({
      where: { userId, status: In(Object.values(WeeklySubscriptionStatus)) },
      relations: { weeklyPlan: true },
      order: { createdAt: "DESC" },
    });
  }

  // --- Webhook-facing handlers ---

  /** Fetches the invoice_pdf URL for a Checkout Session created with `invoice_creation: { enabled: true }`. */
  private async getInvoicePdfUrl(
    invoice: string | { id: string } | null | undefined,
  ): Promise<string | null> {
    const id = typeof invoice === "string" ? invoice : invoice?.id;
    if (!id) return null;
    const retrieved = await this.stripe.invoices.retrieve(id);
    return retrieved.invoice_pdf ?? null;
  }

  /** Sets the card used in a Checkout Session as the customer's new default payment method. */
  private async saveCheckoutPaymentMethodAsDefault(
    user: User,
    paymentIntentId: string | { id: string } | null,
  ): Promise<void> {
    if (!user.stripeCustomerId) return;
    const id =
      typeof paymentIntentId === "string"
        ? paymentIntentId
        : paymentIntentId?.id;
    if (!id) return;
    const paymentIntent = await this.stripe.paymentIntents.retrieve(id);
    const paymentMethodId =
      typeof paymentIntent.payment_method === "string"
        ? paymentIntent.payment_method
        : paymentIntent.payment_method?.id;
    if (!paymentMethodId) return;
    await this.applyDefaultPaymentMethod(user, paymentMethodId);
  }

  /**
   * Sets a payment method as the Stripe customer's default, marks it reusable
   * for future Checkout prefill, and mirrors the card details onto the local
   * `users` row — the payment-method endpoint prefers that local cache and
   * would otherwise keep showing the old card until the cache happens to be
   * invalidated some other way.
   */
  private async applyDefaultPaymentMethod(
    user: User,
    paymentMethodId: string,
  ): Promise<void> {
    if (!user.stripeCustomerId) return;
    await this.stripe.customers.update(user.stripeCustomerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });
    // Without this, Checkout stops prefilling the card for the customer on
    // future checkouts (allow_redisplay defaults to "limited"/unset, and
    // Stripe only prefills cards explicitly marked "always" since May 2024).
    const pm = await this.stripe.paymentMethods.update(paymentMethodId, {
      allow_redisplay: "always",
    });
    if (!pm.card) return;
    user.paymentMethodId = pm.id;
    user.cardBrand = pm.card.brand;
    user.cardLast4 = pm.card.last4;
    user.cardExpMonth = pm.card.exp_month;
    user.cardExpYear = pm.card.exp_year;
    await this.userRepository.save(user);
  }

  async handleStartCheckoutCompleted(session: {
    metadata: Record<string, string> | null;
    subscription: string | { id: string } | null;
  }): Promise<void> {
    const { userId, weeklyPlanId } = session.metadata ?? {};
    const subscriptionId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id;
    if (!userId || !weeklyPlanId || !subscriptionId) {
      this.logger.warn(
        `weekly_start checkout.session.completed missing metadata/subscription`,
      );
      return;
    }

    const existing = await this.weeklySubscriptionRepository.findOne({
      where: { stripeSubscriptionId: subscriptionId },
    });
    if (existing) return; // already recorded (idempotency for webhook retries)

    const plan = await this.weeklyPlanRepository.findOne({
      where: { id: weeklyPlanId },
    });
    if (!plan) {
      this.logger.warn(`weekly_start: plan "${weeklyPlanId}" not found`);
      return;
    }

    await this.weeklySubscriptionRepository.save(
      this.weeklySubscriptionRepository.create({
        userId,
        weeklyPlanId: plan.id,
        stripeSubscriptionId: subscriptionId,
        status: WeeklySubscriptionStatus.ACTIVE,
        totalCycles: plan.totalCycles,
        startedAt: new Date(),
      }),
    );

    // Checkout saves the card used as the new subscription's default payment
    // method automatically, but not as the customer's account-wide default,
    // and not marked reusable in future Checkout Sessions — do both here.
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (user?.stripeCustomerId) {
      const stripeSubscription =
        await this.stripe.subscriptions.retrieve(subscriptionId);
      const defaultPaymentMethod =
        typeof stripeSubscription.default_payment_method === "string"
          ? stripeSubscription.default_payment_method
          : stripeSubscription.default_payment_method?.id;
      if (defaultPaymentMethod) {
        await this.applyDefaultPaymentMethod(user, defaultPaymentMethod);
      }
    }
  }

  async handleUpgradeCheckoutCompleted(session: {
    metadata: Record<string, string> | null;
    payment_intent: string | { id: string } | null;
    invoice?: string | { id: string } | null;
  }): Promise<void> {
    const { weeklySubscriptionId } = session.metadata ?? {};
    if (!weeklySubscriptionId) {
      this.logger.warn(
        "weekly_upgrade checkout.session.completed missing metadata",
      );
      return;
    }

    const sub = await this.weeklySubscriptionRepository.findOne({
      where: { id: weeklySubscriptionId },
      relations: { weeklyPlan: true },
    });
    if (!sub || sub.weeklyPlan.tier === WeeklyPlanTier.FAMILY) return; // already processed

    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id;
    const existing = paymentIntentId
      ? await this.weeklyPaymentHistoryRepository.findOne({
          where: { stripePaymentIntentId: paymentIntentId },
        })
      : null;
    if (existing) return; // idempotency for webhook retries

    const familyPlan = await this.weeklyPlanRepository.findOne({
      where: { tier: WeeklyPlanTier.FAMILY },
    });
    if (!familyPlan) return;

    const { weeklyUpgradeDiffAmount } = this.configService.get("stripe", {
      infer: true,
    });
    const upgradeAmount = sub.cyclesPaid * weeklyUpgradeDiffAmount;

    const stripeSubscription = await this.stripe.subscriptions.retrieve(
      sub.stripeSubscriptionId,
    );
    const itemId = stripeSubscription.items.data[0]?.id;
    await this.stripe.subscriptions.update(sub.stripeSubscriptionId, {
      items: [{ id: itemId, price: familyPlan.stripePriceId }],
      proration_behavior: "none",
    });

    const invoicePdfUrl = await this.getInvoicePdfUrl(session.invoice);

    await this.weeklyPaymentHistoryRepository.save(
      this.weeklyPaymentHistoryRepository.create({
        weeklySubscriptionId: sub.id,
        stripePaymentIntentId: paymentIntentId ?? null,
        cycleNumber: null,
        amount: upgradeAmount,
        currency: familyPlan.currency,
        invoicePdfUrl,
        status: WeeklyPaymentStatus.SUCCEEDED,
        type: WeeklyPaymentType.UPGRADE,
        fromTier: WeeklyPlanTier.SINGLE,
        toTier: WeeklyPlanTier.FAMILY,
      }),
    );

    // Both the FK column and the loaded relation object must be updated —
    // TypeORM's save() writes the relation object's id back over a
    // manually-set weeklyPlanId if the (stale) relation is still attached.
    sub.weeklyPlanId = familyPlan.id;
    sub.weeklyPlan = familyPlan;
    sub.status = WeeklySubscriptionStatus.ACTIVE;
    await this.weeklySubscriptionRepository.save(sub);

    const user = await this.userRepository.findOne({
      where: { id: sub.userId },
    });
    if (user?.stripeCustomerId) {
      await this.saveCheckoutPaymentMethodAsDefault(
        user,
        session.payment_intent,
      );
    }
  }

  async handlePayoffCheckoutCompleted(session: {
    metadata: Record<string, string> | null;
    payment_intent: string | { id: string } | null;
    invoice?: string | { id: string } | null;
  }): Promise<void> {
    const { weeklySubscriptionId, targetTier: rawTargetTier } =
      session.metadata ?? {};
    if (!weeklySubscriptionId) {
      this.logger.warn(
        "weekly_payoff checkout.session.completed missing metadata",
      );
      return;
    }
    const targetTier = rawTargetTier as WeeklyPlanTier | undefined;

    const sub = await this.weeklySubscriptionRepository.findOne({
      where: { id: weeklySubscriptionId },
      relations: { weeklyPlan: true },
    });
    if (!sub || sub.status === WeeklySubscriptionStatus.PAID_OFF) return; // already processed

    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id;
    const existing = paymentIntentId
      ? await this.weeklyPaymentHistoryRepository.findOne({
          where: { stripePaymentIntentId: paymentIntentId },
        })
      : null;
    if (existing) return; // idempotency for webhook retries

    const payoffPlan =
      targetTier && targetTier !== sub.weeklyPlan.tier
        ? await this.weeklyPlanRepository.findOne({
            where: { tier: targetTier },
          })
        : sub.weeklyPlan;
    if (!payoffPlan) return;

    const remainingCycles = sub.totalCycles - sub.cyclesPaid;
    const remainingAmount = remainingCycles * payoffPlan.weeklyPrice;
    const invoicePdfUrl = await this.getInvoicePdfUrl(session.invoice);

    await this.weeklyPaymentHistoryRepository.save(
      this.weeklyPaymentHistoryRepository.create({
        weeklySubscriptionId: sub.id,
        stripePaymentIntentId: paymentIntentId ?? null,
        cycleNumber: null,
        amount: remainingAmount,
        currency: payoffPlan.currency,
        invoicePdfUrl,
        status: WeeklyPaymentStatus.SUCCEEDED,
        type: WeeklyPaymentType.PAYOFF,
        fromTier:
          payoffPlan.tier !== sub.weeklyPlan.tier ? sub.weeklyPlan.tier : null,
        toTier:
          payoffPlan.tier !== sub.weeklyPlan.tier ? payoffPlan.tier : null,
      }),
    );

    sub.status = WeeklySubscriptionStatus.PAID_OFF;
    sub.paidOffAt = new Date();
    sub.cyclesPaid = sub.totalCycles;
    // Both the FK column and the loaded relation object must be updated —
    // TypeORM's save() writes the relation object's id back over a
    // manually-set weeklyPlanId if the (stale) relation is still attached.
    sub.weeklyPlanId = payoffPlan.id;
    sub.weeklyPlan = payoffPlan;
    await this.weeklySubscriptionRepository.save(sub);

    try {
      await this.stripe.subscriptions.cancel(sub.stripeSubscriptionId, {
        prorate: false,
      });
    } catch (err) {
      this.logger.warn(
        `Failed to cancel subscription ${sub.stripeSubscriptionId} after payoff: ${err instanceof Error ? err.message : err}`,
      );
    }

    const user = await this.userRepository.findOne({
      where: { id: sub.userId },
    });
    if (user?.stripeCustomerId) {
      await this.saveCheckoutPaymentMethodAsDefault(
        user,
        session.payment_intent,
      );
    }
  }

  async handleSubscriptionUpdated(
    stripeSubscriptionId: string,
    status: string,
    currentPeriodEnd: Date | null,
  ): Promise<void> {
    const sub = await this.weeklySubscriptionRepository.findOne({
      where: { stripeSubscriptionId },
    });
    if (!sub) return;
    if (sub.status === WeeklySubscriptionStatus.PAID_OFF) return;

    const statusMap: Record<string, WeeklySubscriptionStatus> = {
      active: WeeklySubscriptionStatus.ACTIVE,
      past_due: WeeklySubscriptionStatus.PAST_DUE,
      canceled: WeeklySubscriptionStatus.CANCELED,
      incomplete: WeeklySubscriptionStatus.INCOMPLETE,
      incomplete_expired: WeeklySubscriptionStatus.CANCELED,
      unpaid: WeeklySubscriptionStatus.PAST_DUE,
    };
    const mapped = statusMap[status];
    if (mapped) sub.status = mapped;
    if (mapped === WeeklySubscriptionStatus.ACTIVE && !sub.startedAt) {
      sub.startedAt = new Date();
    }
    sub.currentPeriodEnd = currentPeriodEnd;
    if (mapped === WeeklySubscriptionStatus.CANCELED)
      sub.canceledAt = new Date();
    await this.weeklySubscriptionRepository.save(sub);
  }

  async handleSubscriptionDeleted(stripeSubscriptionId: string): Promise<void> {
    const sub = await this.weeklySubscriptionRepository.findOne({
      where: { stripeSubscriptionId },
    });
    if (!sub || sub.status === WeeklySubscriptionStatus.PAID_OFF) return;
    sub.status = WeeklySubscriptionStatus.CANCELED;
    sub.canceledAt = new Date();
    await this.weeklySubscriptionRepository.save(sub);
  }

  async handleInvoicePaymentSucceeded(
    stripeSubscriptionId: string,
    stripeInvoiceId: string,
    amount: number,
    currency: string,
    invoicePdfUrl: string | null = null,
  ): Promise<void> {
    const sub = await this.weeklySubscriptionRepository.findOne({
      where: { stripeSubscriptionId },
    });
    if (!sub) return;

    const existing = await this.weeklyPaymentHistoryRepository.findOne({
      where: { stripeInvoiceId },
    });
    if (existing) return; // already recorded (idempotency for webhook retries)

    const nextCycle = sub.cyclesPaid + 1;
    await this.weeklyPaymentHistoryRepository.save(
      this.weeklyPaymentHistoryRepository.create({
        weeklySubscriptionId: sub.id,
        stripeInvoiceId,
        cycleNumber: nextCycle,
        amount,
        currency,
        invoicePdfUrl,
        status: WeeklyPaymentStatus.SUCCEEDED,
        type: WeeklyPaymentType.CYCLE,
      }),
    );

    sub.cyclesPaid = nextCycle;
    if (sub.status === WeeklySubscriptionStatus.PAST_DUE) {
      sub.status = WeeklySubscriptionStatus.ACTIVE;
    }
    if (!sub.startedAt) sub.startedAt = new Date();

    if (sub.cyclesPaid >= sub.totalCycles) {
      sub.status = WeeklySubscriptionStatus.PAID_OFF;
      sub.paidOffAt = new Date();
      await this.weeklySubscriptionRepository.save(sub);
      try {
        await this.stripe.subscriptions.cancel(sub.stripeSubscriptionId);
      } catch (err) {
        this.logger.warn(
          `Failed to cancel subscription ${sub.stripeSubscriptionId} after final cycle: ${err instanceof Error ? err.message : err}`,
        );
      }
      return;
    }

    await this.weeklySubscriptionRepository.save(sub);
  }

  async handleInvoicePaymentFailed(
    stripeSubscriptionId: string,
    stripeInvoiceId: string,
    amount: number,
    currency: string,
    failureReason: string | null,
  ): Promise<void> {
    const sub = await this.weeklySubscriptionRepository.findOne({
      where: { stripeSubscriptionId },
    });
    if (!sub) return;

    const existing = await this.weeklyPaymentHistoryRepository.findOne({
      where: { stripeInvoiceId },
    });
    if (existing) {
      existing.status = WeeklyPaymentStatus.FAILED;
      existing.failureReason = failureReason;
      await this.weeklyPaymentHistoryRepository.save(existing);
    } else {
      await this.weeklyPaymentHistoryRepository.save(
        this.weeklyPaymentHistoryRepository.create({
          weeklySubscriptionId: sub.id,
          stripeInvoiceId,
          cycleNumber: sub.cyclesPaid + 1,
          amount,
          currency,
          status: WeeklyPaymentStatus.FAILED,
          type: WeeklyPaymentType.CYCLE,
          failureReason,
        }),
      );
    }

    sub.status = WeeklySubscriptionStatus.PAST_DUE;
    await this.weeklySubscriptionRepository.save(sub);
  }
}
