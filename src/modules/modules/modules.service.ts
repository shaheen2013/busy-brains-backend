import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { UserPlan } from "../subscriptions/entities/user-plan.entity";
import { MAX_MODULES, MODULE_UNLOCK_DAYS } from "./modules.constants";

export type AccessStatus = {
  unlocked: boolean;
  accessible: boolean;
  unlockDate: Date | null;
};

type AllModulesResponse = Record<`module_${number}`, AccessStatus>;
type SingleModuleResponse = Record<`module_${number}`, AccessStatus>;
type QuestResponse = Record<
  `module_${number}`,
  Record<`quest_${number}`, AccessStatus>
>;
type ScreenResponse = Record<
  `module_${number}`,
  Record<`quest_${number}`, Record<`screen_${number}`, AccessStatus>>
>;

export type AccessStatusResponse =
  | AllModulesResponse
  | SingleModuleResponse
  | QuestResponse
  | ScreenResponse;

@Injectable()
export class ModulesService {
  constructor(
    @InjectRepository(UserPlan)
    private readonly userPlanRepository: Repository<UserPlan>,
  ) {}

  async getAccessStatus(
    userId: string,
    moduleNo?: number,
    questNo?: number,
    screenNo?: number,
  ): Promise<AccessStatusResponse> {
    if (
      screenNo !== undefined &&
      (questNo === undefined || moduleNo === undefined)
    ) {
      throw new BadRequestException("screen requires both module and quest");
    }
    if (questNo !== undefined && moduleNo === undefined) {
      throw new BadRequestException("quest requires module");
    }

    const userPlan = await this.userPlanRepository.findOne({
      where: { userId, isActive: true },
    });

    const purchasedAt = userPlan?.isTrial
      ? null
      : (userPlan?.purchasedAt ?? null);

    if (moduleNo !== undefined) {
      const status = this.resolveModuleStatus(moduleNo, purchasedAt);

      if (questNo !== undefined && screenNo !== undefined) {
        return {
          [`module_${moduleNo}`]: {
            [`quest_${questNo}`]: {
              [`screen_${screenNo}`]: status,
            },
          },
        };
      }

      if (questNo !== undefined) {
        return {
          [`module_${moduleNo}`]: {
            [`quest_${questNo}`]: status,
          },
        };
      }

      return { [`module_${moduleNo}`]: status };
    }

    // All modules
    const result: AllModulesResponse = {};
    for (let i = 1; i <= MAX_MODULES; i++) {
      result[`module_${i}`] = this.resolveModuleStatus(i, purchasedAt);
    }
    return result;
  }

  private resolveModuleStatus(
    moduleNo: number,
    purchasedAt: Date | null,
  ): AccessStatus {
    if (moduleNo === 1) {
      return { unlocked: true, accessible: true, unlockDate: null };
    }

    if (!purchasedAt) {
      return { unlocked: false, accessible: false, unlockDate: null };
    }

    const delayDays = MODULE_UNLOCK_DAYS[moduleNo] ?? (moduleNo - 2) * 14;
    const unlockDate = new Date(purchasedAt);
    unlockDate.setDate(unlockDate.getDate() + delayDays);

    const unlocked = new Date() >= unlockDate;
    return { unlocked, accessible: unlocked, unlockDate };
  }
}
