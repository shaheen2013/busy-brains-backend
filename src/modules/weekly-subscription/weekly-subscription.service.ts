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

type StripeTypes = InstanceType<typeof Stripe>;

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

  async start(
    user: User,
    tier: WeeklyPlanTier,
    paymentMethodId?: string,
  ): Promise<{ weeklySubscriptionId: string; clientSecret?: string }> {
    const existing = await this.getActiveSubscription(user.id);
    if (existing) {
      throw new ConflictException(
        "User already has an active weekly subscription",
      );
    }

    const plan = await this.weeklyPlanRepository.findOne({ where: { tier } });
    if (!plan) throw new NotFoundException(`Weekly plan "${tier}" not found`);

    const stripeCustomerId = await this.ensureStripeCustomer(user);

    if (paymentMethodId) {
      await this.stripe.paymentMethods.attach(paymentMethodId, {
        customer: stripeCustomerId,
      });
      await this.stripe.customers.update(stripeCustomerId, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });
    }

    // Stripe only auto-attempts a "default_incomplete" subscription's first
    // invoice when a payment method is set on the SUBSCRIPTION itself — the
    // customer's invoice_settings.default_payment_method is not enough on
    // its own, so without this the subscription just sits incomplete forever.
    let subscriptionPaymentMethodId = paymentMethodId;
    if (!subscriptionPaymentMethodId) {
      const customer = (await this.stripe.customers.retrieve(stripeCustomerId, {
        expand: ["invoice_settings.default_payment_method"],
      })) as any;
      const defaultPm = customer?.deleted
        ? null
        : (customer?.invoice_settings?.default_payment_method ?? null);
      subscriptionPaymentMethodId =
        typeof defaultPm === "string" ? defaultPm : defaultPm?.id;
    }

    if (!subscriptionPaymentMethodId) {
      throw new BadRequestException("No default payment method on file");
    }

    const subscription = await this.stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: [{ price: plan.stripePriceId }],
      metadata: {
        userId: user.id,
        weeklyPlanId: plan.id,
        totalCycles: String(plan.totalCycles),
      },
      default_payment_method: subscriptionPaymentMethodId,
      payment_behavior: "default_incomplete",
      payment_settings: { save_default_payment_method: "on_subscription" },
    });

    const saved = await this.weeklySubscriptionRepository.save(
      this.weeklySubscriptionRepository.create({
        userId: user.id,
        weeklyPlanId: plan.id,
        stripeSubscriptionId: subscription.id,
        status: WeeklySubscriptionStatus.INCOMPLETE,
        totalCycles: plan.totalCycles,
      }),
    );

    // `default_incomplete` creates the subscription's first invoice with a
    // PaymentIntent shell but does NOT confirm/attempt it — Stripe's own
    // auto-attempt is not synchronous/guaranteed here, so explicitly pay the
    // invoice ourselves right away rather than leaving it to sit "open"
    // forever with nothing to trigger a charge attempt.
    const invoiceId =
      typeof subscription.latest_invoice === "string"
        ? subscription.latest_invoice
        : subscription.latest_invoice?.id;

    let clientSecret: string | undefined;
    if (invoiceId) {
      try {
        await this.stripe.invoices.pay(invoiceId);
      } catch (err: any) {
        const paymentIntent = err?.raw?.payment_intent ?? err?.payment_intent;
        if (paymentIntent?.status === "requires_action") {
          clientSecret = paymentIntent.client_secret ?? undefined;
        } else {
          this.logger.warn(
            `Failed to pay invoice ${invoiceId} for new weekly subscription ${subscription.id}: ${err instanceof Error ? err.message : err}`,
          );
        }
      }
    }

    return { weeklySubscriptionId: saved.id, clientSecret };
  }

  async payoff(
    user: User,
    targetTier?: WeeklyPlanTier,
  ): Promise<{
    weeklySubscriptionId: string;
    amountCharged: number;
    status: "paid_off";
  }> {
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
    const user_ = await this.userRepository.findOne({ where: { id: user.id } });
    const stripeCustomerId = await this.ensureStripeCustomer(user_);

    const customer = (await this.stripe.customers.retrieve(
      stripeCustomerId,
    )) as any;
    const defaultPaymentMethod: string | null = customer?.deleted
      ? null
      : (customer?.invoice_settings?.default_payment_method ?? null);
    if (!defaultPaymentMethod) {
      throw new BadRequestException("No default payment method on file");
    }

    let paymentIntent: Awaited<
      ReturnType<StripeTypes["paymentIntents"]["create"]>
    >;
    try {
      paymentIntent = await this.stripe.paymentIntents.create({
        customer: stripeCustomerId,
        payment_method: defaultPaymentMethod,
        amount: remainingAmount,
        currency: payoffPlan.currency,
        off_session: true,
        confirm: true,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Card declined";
      throw new BadRequestException(`Payoff charge failed: ${message}`);
    }

    await this.weeklyPaymentHistoryRepository.save(
      this.weeklyPaymentHistoryRepository.create({
        weeklySubscriptionId: sub.id,
        stripePaymentIntentId: paymentIntent.id,
        cycleNumber: null,
        amount: remainingAmount,
        currency: payoffPlan.currency,
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
    sub.weeklyPlanId = payoffPlan.id;
    await this.weeklySubscriptionRepository.save(sub);

    await this.stripe.subscriptions.cancel(sub.stripeSubscriptionId, {
      prorate: false,
    });

    return {
      weeklySubscriptionId: sub.id,
      amountCharged: remainingAmount,
      status: "paid_off",
    };
  }

  async upgrade(user: User): Promise<{
    weeklySubscriptionId: string;
    amountCharged: number;
    newTier: WeeklyPlanTier;
  }> {
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
    // the start. The price swap below makes every future cycle bill at the
    // Family rate automatically, so remaining (unpaid) cycles aren't charged here.
    const { weeklyUpgradeDiffAmount } = this.configService.get("stripe", {
      infer: true,
    });
    const upgradeAmount = sub.cyclesPaid * weeklyUpgradeDiffAmount;

    const user_ = await this.userRepository.findOne({ where: { id: user.id } });
    const stripeCustomerId = await this.ensureStripeCustomer(user_);
    const customer = (await this.stripe.customers.retrieve(
      stripeCustomerId,
    )) as any;
    const defaultPaymentMethod: string | null = customer?.deleted
      ? null
      : (customer?.invoice_settings?.default_payment_method ?? null);
    if (!defaultPaymentMethod) {
      throw new BadRequestException("No default payment method on file");
    }

    let paymentIntent: Awaited<
      ReturnType<StripeTypes["paymentIntents"]["create"]>
    >;
    try {
      paymentIntent = await this.stripe.paymentIntents.create({
        customer: stripeCustomerId,
        payment_method: defaultPaymentMethod,
        amount: upgradeAmount,
        currency: familyPlan.currency,
        off_session: true,
        confirm: true,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Card declined";
      throw new BadRequestException(`Upgrade charge failed: ${message}`);
    }

    const stripeSubscription = await this.stripe.subscriptions.retrieve(
      sub.stripeSubscriptionId,
    );
    const itemId = stripeSubscription.items.data[0]?.id;
    await this.stripe.subscriptions.update(sub.stripeSubscriptionId, {
      items: [{ id: itemId, price: familyPlan.stripePriceId }],
      proration_behavior: "none",
    });

    await this.weeklyPaymentHistoryRepository.save(
      this.weeklyPaymentHistoryRepository.create({
        weeklySubscriptionId: sub.id,
        stripePaymentIntentId: paymentIntent.id,
        cycleNumber: null,
        amount: upgradeAmount,
        currency: familyPlan.currency,
        status: WeeklyPaymentStatus.SUCCEEDED,
        type: WeeklyPaymentType.UPGRADE,
        fromTier: WeeklyPlanTier.SINGLE,
        toTier: WeeklyPlanTier.FAMILY,
      }),
    );

    sub.weeklyPlanId = familyPlan.id;
    sub.status = WeeklySubscriptionStatus.ACTIVE;
    await this.weeklySubscriptionRepository.save(sub);

    return {
      weeklySubscriptionId: sub.id,
      amountCharged: upgradeAmount,
      newTier: WeeklyPlanTier.FAMILY,
    };
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
