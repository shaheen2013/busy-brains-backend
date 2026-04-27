import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Plan, PlanName } from "../subscriptions/entities/plan.entity";
import { UserPlan } from "../subscriptions/entities/user-plan.entity";
import { User } from "../users/entities/user.entity";

const TRIAL_DAYS = 14;

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Plan)
    private readonly planRepository: Repository<Plan>,
    @InjectRepository(UserPlan)
    private readonly userPlanRepository: Repository<UserPlan>,
  ) {}

  async startTrial(user: User, planName: PlanName): Promise<UserPlan> {
    const existing = await this.userPlanRepository.findOne({
      where: { userId: user.id, isActive: true },
    });

    if (existing) {
      throw new ConflictException(
        "User already has an active plan or trial",
      );
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
}
