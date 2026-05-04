import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { UserPlan } from "../subscriptions/entities/user-plan.entity";
import { Child } from "../children/entities/child.entity";
import { ChildModule } from "../children/entities/child-module.entity";
import {
  MODULE_UNLOCK_DAYS,
  MAX_MODULES,
} from "../../constants/modules.constants";
import {
  PARENT_RESOURCES,
  ParentResource,
} from "../../common/parent-resources.constants";

@Injectable()
export class ParentResourcesService {
  constructor(
    @InjectRepository(UserPlan)
    private readonly userPlanRepository: Repository<UserPlan>,
    @InjectRepository(Child)
    private readonly childRepository: Repository<Child>,
    @InjectRepository(ChildModule)
    private readonly childModuleRepository: Repository<ChildModule>,
  ) {}

  async getResources(userId: string): Promise<ParentResource[]> {
    const userPlan = await this.userPlanRepository.findOne({
      where: { userId, isActive: true },
    });

    const unlockedModules = this.resolveUnlockedModules(userPlan ?? null);
    if (unlockedModules.size === 0) return [];

    const children = await this.childRepository.find({ where: { userId } });
    if (children.length === 0) return [];

    const childIds = children.map((c) => c.id);
    const completedModules = await this.childModuleRepository.find({
      where: { childId: In(childIds), isCompleted: true },
    });

    const completedModuleNos = new Set(completedModules.map((m) => m.moduleNo));

    return PARENT_RESOURCES.filter(
      (r) => unlockedModules.has(r.module) && completedModuleNos.has(r.module),
    );
  }

  private resolveUnlockedModules(userPlan: UserPlan | null): Set<number> {
    const unlocked = new Set<number>();

    for (let moduleNo = 1; moduleNo <= MAX_MODULES; moduleNo++) {
      if (moduleNo === 1) {
        unlocked.add(1);
        continue;
      }

      if (!userPlan?.purchasedAt) continue;

      const delayDays = MODULE_UNLOCK_DAYS[moduleNo] ?? (moduleNo - 2) * 14;
      const unlockDate = new Date(userPlan.purchasedAt);
      unlockDate.setDate(unlockDate.getDate() + delayDays);

      if (new Date() >= unlockDate) {
        unlocked.add(moduleNo);
      }
    }

    return unlocked;
  }
}
