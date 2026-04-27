import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";
import { Repository } from "typeorm";
import Stripe from "stripe";
import { Plan, PlanName } from "../subscriptions/entities/plan.entity";
import { UserPlan } from "../subscriptions/entities/user-plan.entity";
import { User } from "../users/entities/user.entity";

const TRIAL_DAYS = 14;

@Injectable()
export class PaymentService {
  private stripe: Stripe.Stripe;

  constructor(
    @InjectRepository(Plan)
    private readonly planRepository: Repository<Plan>,
    @InjectRepository(UserPlan)
    private readonly userPlanRepository: Repository<UserPlan>,
    private readonly configService: ConfigService,
  ) {
    const secretKey = this.configService.get<string>("stripe.secretKey");
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

    if (existing) {
      throw new ConflictException("User already has an active plan");
    }

    const plan = await this.planRepository.findOneBy({ name: planName });
    if (!plan) {
      throw new NotFoundException(`Plan "${planName}" not found`);
    }

    const frontendUrl =
      this.configService.get<string>("FRONTEND_URL") ?? "http://localhost:3000";

    const session = await this.stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      customer_email: user.email,
      client_reference_id: user.id,
      metadata: {
        userId: user.id,
        planName: plan.name,
      },
      success_url: `${frontendUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/payment/cancel`,
    });

    return { sessionId: session.id, url: session.url! };
  }

  async activatePlanForUser(userId: string, planName: PlanName): Promise<void> {
    const plan = await this.planRepository.findOneBy({ name: planName });
    if (!plan) return;

    const now = new Date();
    const existing = await this.userPlanRepository.findOne({
      where: { userId },
    });

    if (existing) {
      await this.userPlanRepository.save({
        ...existing,
        planId: plan.id,
        isTrial: false,
        isActive: true,
        purchasedAt: now,
        trialStartedAt: null,
        trialEndsAt: null,
      });
    } else {
      await this.userPlanRepository.save(
        this.userPlanRepository.create({
          userId,
          planId: plan.id,
          isTrial: false,
          isActive: true,
          purchasedAt: now,
        }),
      );
    }
  }
}
