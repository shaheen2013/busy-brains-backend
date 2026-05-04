import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { UserPlan } from "../subscriptions/entities/user-plan.entity";
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
  ) {}

  async getResources(userId: string): Promise<ParentResource[]> {
    const userPlan = await this.userPlanRepository.findOne({
      where: { userId, isActive: true },
    });

    if (!userPlan) return [];

    if (
      userPlan.plan.name === PlanName.SOLO_EXPLORER ||
      userPlan.plan.name === PlanName.FAMILY_PACK
    ) {
      return PARENT_RESOURCES;
    }

    return [];
  }
}
