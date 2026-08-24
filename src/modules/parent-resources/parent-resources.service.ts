import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { UserPlan } from "../subscriptions/entities/user-plan.entity";
import {
  WeeklySubscription,
  WeeklySubscriptionStatus,
} from "../subscriptions/entities/weekly-subscription.entity";
import {
  PARENT_RESOURCES,
  ParentResource,
} from "../../common/parent-resources.constants";
import { PlanName } from "../subscriptions/entities/plan.entity";

@Injectable()
export class ParentResourcesService {
  constructor(
    @InjectRepository(UserPlan)
    private readonly userPlanRepository: Repository<UserPlan>,
    @InjectRepository(WeeklySubscription)
    private readonly weeklySubscriptionRepository: Repository<WeeklySubscription>,
  ) {}

  async getResources(userId: string): Promise<ParentResource[]> {
    const userPlan = await this.userPlanRepository.findOne({
      where: { userId, isActive: true },
      relations: ["plan"],
    });

    if (
      userPlan?.plan?.name === PlanName.SOLO_EXPLORER ||
      userPlan?.plan?.name === PlanName.FAMILY_PACK
    ) {
      return PARENT_RESOURCES;
    }

    // A weekly subscriber (active, past_due, or paid off) has no UserPlan
    // row at all — this must be checked separately, same as
    // modules.service.ts / dashboard.service.ts / children.service.ts.
    const weeklySubscription = await this.weeklySubscriptionRepository.findOne({
      where: {
        userId,
        status: In([
          WeeklySubscriptionStatus.ACTIVE,
          WeeklySubscriptionStatus.PAST_DUE,
          WeeklySubscriptionStatus.PAID_OFF,
        ]),
      },
    });
    if (weeklySubscription) return PARENT_RESOURCES;

    return [];
  }
}
