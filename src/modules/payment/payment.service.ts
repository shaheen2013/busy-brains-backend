import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";
import { Repository } from "typeorm";
import Stripe from "stripe";
import { AppConfig } from "../../config/app.config";
import { Plan, PlanName } from "../subscriptions/entities/plan.entity";
import { UserPlan } from "../subscriptions/entities/user-plan.entity";
import { PaymentHistory } from "../subscriptions/entities/payment-history.entity";
import { User } from "../users/entities/user.entity";

const TRIAL_DAYS = 14;

type StripeTypes = InstanceType<typeof Stripe>;
type Invoice = Awaited<ReturnType<StripeTypes["invoices"]["retrieve"]>>;
type ExpandedInvoice = Invoice & {
  payment_intent: string | { id: string } | null;
};

@Injectable()
export class PaymentService {
  private stripe: Stripe.Stripe;

  constructor(
    @InjectRepository(Plan)
    private readonly planRepository: Repository<Plan>,
    @InjectRepository(UserPlan)
    private readonly userPlanRepository: Repository<UserPlan>,
    @InjectRepository(PaymentHistory)
    private readonly paymentHistoryRepository: Repository<PaymentHistory>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly configService: ConfigService<AppConfig>,
  ) {
    const { secretKey } = this.configService.get("stripe", { infer: true });
    if (!secretKey) throw new Error("STRIPE_SECRET_KEY is not configured");
    this.stripe = new Stripe(secretKey, { apiVersion: "2026-04-22.dahlia" });
  }

  async startTrial(user: User): Promise<UserPlan> {
    const existing = await this.userPlanRepository.findOne({
      where: { userId: user.id, isActive: true },
    });

    if (existing) {
      throw new ConflictException("User already has an active plan or trial");
    }

    const now = new Date();
    const trialEndsAt = new Date(now);
    trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);

    return this.userPlanRepository.save(
      this.userPlanRepository.create({
        userId: user.id,
        planId: null,
        isTrial: true,
        isActive: true,
        trialStartedAt: now,
        trialEndsAt,
      }),
    );
  }

  async startPlan(
    user: User,
    planName: PlanName,
  ): Promise<{ sessionId: string; url: string }> {
    const existing = await this.userPlanRepository.findOne({
      where: { userId: user.id, isActive: true },
    });

    if (existing && !existing.isTrial) {
      throw new ConflictException("User already has an active plan");
    }

    const plan = await this.planRepository.findOne({
      where: { name: planName },
    });
    if (!plan) {
      throw new NotFoundException(`Plan "${planName}" not found`);
    }

    const baseUrl = this.configService.get("frontendUrl", { infer: true });

    let stripeCustomerId = user.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await this.stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id },
      });

      stripeCustomerId = customer.id;
      user.stripeCustomerId = stripeCustomerId;
      await this.userRepository.save(user);
    }

    const session = await this.stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      client_reference_id: user.id,
      metadata: { userId: user.id, planName: plan.name },
      invoice_creation: { enabled: true },
      success_url: `${baseUrl}/panel/subscription?complete=true`,
      cancel_url: `${baseUrl}/panel/subscription`,
      customer: stripeCustomerId,
      allow_promotion_codes: true,
    });

    return { sessionId: session.id, url: session.url ?? "" };
  }

  async upgradePlan(user: User): Promise<{ sessionId: string; url: string }> {
    const existing = await this.userPlanRepository.findOne({
      where: { userId: user.id, isActive: true },
      relations: { plan: true },
    });

    if (
      !existing ||
      existing.isTrial ||
      existing.plan?.name !== PlanName.SOLO_EXPLORER
    ) {
      throw new ConflictException(
        "Upgrade is only available for active Solo Explorer subscribers",
      );
    }

    const familyPlan = await this.planRepository.findOne({
      where: { name: PlanName.FAMILY_PACK },
    });
    if (!familyPlan) {
      throw new NotFoundException(`Plan "FAMILY_PACK" not found`);
    }

    const baseUrl = this.configService.get("frontendUrl", { infer: true });

    let stripeCustomerId = user.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await this.stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id },
      });
      stripeCustomerId = customer.id;
      user.stripeCustomerId = stripeCustomerId;
      await this.userRepository.save(user);
    }

    const { upgradePriceId } = this.configService.get("stripe", {
      infer: true,
    });

    const session = await this.stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: upgradePriceId, quantity: 1 }],
      client_reference_id: user.id,
      metadata: {
        userId: user.id,
        planName: familyPlan.name,
        isUpgrade: "true",
      },
      invoice_creation: { enabled: true },
      success_url: `${baseUrl}/panel/subscription?complete=true`,
      cancel_url: `${baseUrl}/panel/subscription`,
      customer: stripeCustomerId,
      allow_promotion_codes: true,
    });

    return { sessionId: session.id, url: session.url ?? "" };
  }

  async handlePaymentIntentSucceeded(
    paymentIntentId: string,
    amount: number,
    currency: string,
  ): Promise<void> {
    const existing = await this.paymentHistoryRepository.findOne({
      where: { stripePaymentIntentId: paymentIntentId },
    });

    if (existing) {
      existing.status = "succeeded";
      await this.paymentHistoryRepository.save(existing);
    } else {
      // checkout.session.completed hasn't arrived yet — create partial record
      await this.paymentHistoryRepository.save(
        this.paymentHistoryRepository.create({
          stripePaymentIntentId: paymentIntentId,
          status: "succeeded",
          amount,
          currency,
        }),
      );
    }

    Logger.log(`payment_intent.succeeded: ${paymentIntentId}`);
  }

  async handlePaymentIntentFailed(paymentIntentId: string): Promise<void> {
    const existing = await this.paymentHistoryRepository.findOne({
      where: { stripePaymentIntentId: paymentIntentId },
    });

    if (existing) {
      existing.status = "failed";
      await this.paymentHistoryRepository.save(existing);
      if (existing.paymentId) {
        await this.userPlanRepository.update(existing.paymentId, {
          isActive: false,
        });
      }
    } else {
      await this.paymentHistoryRepository.save(
        this.paymentHistoryRepository.create({
          stripePaymentIntentId: paymentIntentId,
          status: "failed",
        }),
      );
    }

    Logger.log(`payment_intent.payment_failed: ${paymentIntentId}`);
  }

  async handleCheckoutCompleted(
    userId: string,
    planName: PlanName,
    session: {
      id: string;
      payment_intent: string | null;
      amount_total: number | null;
      currency: string | null;
    },
  ): Promise<void> {
    const plan = await this.planRepository.findOne({
      where: { name: planName },
    });
    if (!plan) return;

    if (!session.payment_intent) {
      Logger.warn(
        `checkout.session.completed missing payment_intent: ${session.id}`,
      );
      return;
    }

    const now = new Date();

    // Activate or create the UserPlan
    let userPlan = await this.userPlanRepository.findOne({
      where: { userId },
    });

    if (userPlan) {
      userPlan.planId = plan.id;
      userPlan.isTrial = false;
      userPlan.isActive = true;
      userPlan.purchasedAt = now;
    } else {
      userPlan = this.userPlanRepository.create({
        userId,
        planId: plan.id,
        isTrial: false,
        isActive: true,
        purchasedAt: now,
      });
    }

    const savedPlan = await this.userPlanRepository.save(userPlan);

    // Fill in the partial record created by payment_intent event, or create fresh
    const existing = await this.paymentHistoryRepository.findOne({
      where: { stripePaymentIntentId: session.payment_intent },
    });

    if (existing) {
      existing.userId = userId;
      existing.planId = plan.id;
      existing.paymentId = savedPlan.id;
      existing.amount = session.amount_total ?? existing.amount;
      existing.currency = session.currency ?? existing.currency;
      existing.stripeCheckoutSessionId = session.id;
      await this.paymentHistoryRepository.save(existing);
    } else {
      await this.paymentHistoryRepository.save(
        this.paymentHistoryRepository.create({
          userId,
          paymentId: savedPlan.id,
          planId: plan.id,
          amount: session.amount_total ?? 0,
          currency: session.currency ?? "usd",
          stripePaymentIntentId: session.payment_intent,
          stripeCheckoutSessionId: session.id,
          status: "processing",
        }),
      );
    }
  }

  async handleInvoicePaid(
    invoiceId: string,
    invoicePdfUrl: string | null,
  ): Promise<void> {
    const invoice: ExpandedInvoice = (await this.stripe.invoices.retrieve(
      invoiceId,
      {
        expand: ["payment_intent"],
      },
    )) as ExpandedInvoice;

    const expandedPaymentIntent =
      typeof invoice.payment_intent === "string"
        ? invoice.payment_intent
        : invoice.payment_intent?.id;

    // Prefer the freshly retrieved invoice PDF over the event payload value
    const pdfUrl = invoice.invoice_pdf ?? invoicePdfUrl;

    const record = await this.paymentHistoryRepository.findOne({
      where: { stripePaymentIntentId: expandedPaymentIntent },
    });

    if (record) {
      record.invoicePdfUrl = pdfUrl;
      await this.paymentHistoryRepository.save(record);
    } else {
      // invoice.payment_succeeded arrived before checkout.session.completed —
      // create a stub record so the PDF URL is not lost; handleCheckoutCompleted
      // will fill in userId, planId, and amount when it runs
      await this.paymentHistoryRepository.save(
        this.paymentHistoryRepository.create({
          stripePaymentIntentId: expandedPaymentIntent,
          invoicePdfUrl: pdfUrl,
          status: "pending",
        }),
      );
    }
  }

  async getPaymentHistory(userId: string): Promise<PaymentHistory[]> {
    return this.paymentHistoryRepository.find({
      where: { userId },
      relations: { plan: true },
      order: { createdAt: "DESC" },
    });
  }
}
