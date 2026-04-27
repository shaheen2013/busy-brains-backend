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
    private readonly configService: ConfigService<AppConfig>,
  ) {
    const { secretKey } = this.configService.get("stripe", { infer: true });
    if (!secretKey) throw new Error("STRIPE_SECRET_KEY is not configured");
    this.stripe = new Stripe(secretKey, { apiVersion: "2026-04-22.dahlia" });
  }

  async startTrial(user: User, planName: PlanName): Promise<UserPlan> {
    const existing = await this.userPlanRepository.findOne({
      where: { userId: user.id, isActive: true },
    });

    if (existing) {
      throw new ConflictException("User already has an active plan or trial");
    }

    const plan = await this.planRepository.findOneBy({ name: planName });
    if (!plan) {
      throw new NotFoundException(`Plan "${planName}" not found`);
    }

    const now = new Date();
    const trialEndsAt = new Date(now);
    trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);

    const userPlan = this.userPlanRepository.create({
      userId: user.id,
      planId: plan.id,
      isTrial: true,
      isActive: true,
      trialStartedAt: now,
      trialEndsAt,
    });

    const saved = await this.userPlanRepository.save(userPlan);
    saved.plan = plan;
    return saved;
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

    const plan = await this.planRepository.findOneBy({ name: planName });
    if (!plan) {
      throw new NotFoundException(`Plan "${planName}" not found`);
    }

    const baseUrl = this.configService.get("frontendUrl", { infer: true });

    const session = await this.stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      customer_email: user.email,
      client_reference_id: user.id,
      metadata: { userId: user.id, planName: plan.name },
      invoice_creation: { enabled: true },
      success_url: `${baseUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/payment/cancel`,
    });

    return { sessionId: session.id, url: session.url ?? "" };
  }

  async handlePaymentIntentSucceeded(
    paymentIntentId: string,
    amount: number,
    currency: string,
  ): Promise<void> {
    const existing = await this.paymentHistoryRepository.findOneBy({
      stripePaymentIntentId: paymentIntentId,
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
    const existing = await this.paymentHistoryRepository.findOneBy({
      stripePaymentIntentId: paymentIntentId,
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
    const plan = await this.planRepository.findOneBy({ name: planName });
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
      userPlan.trialStartedAt = null;
      userPlan.trialEndsAt = null;
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
    const existing = await this.paymentHistoryRepository.findOneBy({
      stripePaymentIntentId: session.payment_intent,
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

    const record = await this.paymentHistoryRepository.findOneBy({
      stripePaymentIntentId: expandedPaymentIntent,
    });
    if (!record) return;

    record.invoicePdfUrl = invoicePdfUrl;
    await this.paymentHistoryRepository.save(record);
  }

  async getPaymentHistory(userId: string): Promise<PaymentHistory[]> {
    return this.paymentHistoryRepository.find({
      where: { userId },
      relations: { plan: true },
      order: { createdAt: "DESC" },
    });
  }
}
