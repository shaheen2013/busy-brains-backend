import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { UserPlan } from "../subscriptions/entities/user-plan.entity";
import { Child } from "../children/entities/child.entity";
import { ChildModule } from "../children/entities/child-module.entity";
import { ChildQuest } from "../children/entities/child-quest.entity";
import { ChildScreen } from "../children/entities/child-screen.entity";
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
    @InjectRepository(Child)
    private readonly childRepository: Repository<Child>,
    @InjectRepository(ChildModule)
    private readonly childModuleRepository: Repository<ChildModule>,
    @InjectRepository(ChildQuest)
    private readonly childQuestRepository: Repository<ChildQuest>,
    @InjectRepository(ChildScreen)
    private readonly childScreenRepository: Repository<ChildScreen>,
  ) {}

  async getAccessStatus(
    userId: string,
    childId: string,
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

    const child = await this.childRepository.findOneBy({ id: childId, userId });
    if (!child) throw new ForbiddenException("Child not found");

    const userPlan = await this.userPlanRepository.findOne({
      where: { userId, isActive: true },
    });

    const baseDate = this.resolveBaseDate(userPlan ?? null);

    if (moduleNo !== undefined) {
      const prevChildModule =
        moduleNo > 1
          ? await this.childModuleRepository.findOneBy({
              childId,
              moduleNo: moduleNo - 1,
            })
          : null;

      const moduleStatus = this.resolveModuleStatus(
        moduleNo,
        baseDate,
        prevChildModule,
      );

      if (questNo !== undefined) {
        const childModule = await this.childModuleRepository.findOneBy({
          childId,
          moduleNo,
        });

        const prevChildQuest =
          questNo > 1 && childModule
            ? await this.childQuestRepository.findOneBy({
                moduleId: childModule.id,
                questNo: questNo - 1,
              })
            : null;

        const questAccessible =
          moduleStatus.accessible &&
          (questNo === 1 || (prevChildQuest?.isCompleted ?? false));

        if (screenNo !== undefined) {
          const childQuest = childModule
            ? await this.childQuestRepository.findOneBy({
                moduleId: childModule.id,
                questNo,
              })
            : null;

          const prevChildScreen =
            screenNo > 1 && childQuest
              ? await this.childScreenRepository.findOneBy({
                  questId: childQuest.id,
                  screenNo: screenNo - 1,
                })
              : null;

          const screenAccessible =
            questAccessible &&
            (screenNo === 1 || (prevChildScreen?.isCompleted ?? false));

          return {
            [`module_${moduleNo}`]: {
              [`quest_${questNo}`]: {
                [`screen_${screenNo}`]: {
                  unlocked: moduleStatus.unlocked,
                  accessible: screenAccessible,
                  unlockDate: moduleStatus.unlockDate,
                },
              },
            },
          };
        }

        return {
          [`module_${moduleNo}`]: {
            [`quest_${questNo}`]: {
              unlocked: moduleStatus.unlocked,
              accessible: questAccessible,
              unlockDate: moduleStatus.unlockDate,
            },
          },
        };
      }

      return { [`module_${moduleNo}`]: moduleStatus };
    }

    // All modules — load child's module records in one query
    const childModules = await this.childModuleRepository.findBy({ childId });
    const moduleMap = new Map(childModules.map((m) => [m.moduleNo, m]));

    const result: AllModulesResponse = {};
    for (let i = 1; i <= MAX_MODULES; i++) {
      const prevChildModule = i > 1 ? (moduleMap.get(i - 1) ?? null) : null;
      result[`module_${i}`] = this.resolveModuleStatus(
        i,
        baseDate,
        prevChildModule,
      );
    }
    return result;
  }

  private resolveBaseDate(userPlan: UserPlan | null): Date | null {
    if (!userPlan?.purchasedAt) return null;

    const trialBase = userPlan.trialEndsAt;
    const purchaseBase = userPlan.purchasedAt;

    return trialBase && trialBase > purchaseBase ? trialBase : purchaseBase;
  }

  private resolveModuleStatus(
    moduleNo: number,
    baseDate: Date | null,
    prevChildModule: ChildModule | null,
  ): AccessStatus {
    if (moduleNo === 1) {
      return { unlocked: true, accessible: true, unlockDate: null };
    }

    if (!baseDate) {
      return { unlocked: false, accessible: false, unlockDate: null };
    }

    const delayDays = MODULE_UNLOCK_DAYS[moduleNo] ?? (moduleNo - 2) * 14;
    const unlockDate = new Date(baseDate);
    unlockDate.setDate(unlockDate.getDate() + delayDays);

    const unlocked = new Date() >= unlockDate;
    if (!unlocked) {
      return { unlocked: false, accessible: false, unlockDate };
    }

    const accessible = prevChildModule?.isCompleted ?? false;
    return { unlocked, accessible, unlockDate };
  }
}
