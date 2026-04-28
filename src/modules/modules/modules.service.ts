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
import { moduleRegistry } from "../../constants/module-registry";

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

  async getAccessHierarchy(userId: string, childId: string) {
    const child = await this.childRepository.findOneBy({ id: childId, userId });
    if (!child) throw new ForbiddenException("Child not found");

    const userPlan = await this.userPlanRepository.findOne({
      where: { userId, isActive: true },
    });

    const baseDate = this.resolveBaseDate(userPlan ?? null);

    // Fetch all child modules, quests, and screens
    const childModules = await this.childModuleRepository.findBy({ childId });
    const moduleMap = new Map(childModules.map((m) => [m.moduleNo, m]));

    const childQuests =
      childModules.length > 0
        ? await this.childQuestRepository
            .createQueryBuilder("cq")
            .where("cq.moduleId IN (:...moduleIds)", {
              moduleIds: childModules.map((m) => m.id),
            })
            .getMany()
        : [];

    const childScreens =
      childQuests.length > 0
        ? await this.childScreenRepository
            .createQueryBuilder("cs")
            .where("cs.questId IN (:...questIds)", {
              questIds: childQuests.map((q) => q.id),
            })
            .getMany()
        : [];

    const result: any = {};

    // Build hierarchy for all 6 modules
    for (let moduleNo = 1; moduleNo <= MAX_MODULES; moduleNo++) {
      const prevChildModule =
        moduleNo > 1 ? (moduleMap.get(moduleNo - 1) ?? null) : null;
      const moduleStatus = this.resolveModuleStatus(
        moduleNo,
        baseDate,
        prevChildModule,
      );
      const childModule = moduleMap.get(moduleNo);

      result[`module_${moduleNo}`] = {
        ...moduleStatus,
        isCompleted: childModule?.isCompleted ?? false,
      };

      // Add quests if module is unlocked
      if (moduleStatus.unlocked) {
        const childModule = moduleMap.get(moduleNo);
        const quests = childModule
          ? childQuests.filter((q) => q.moduleId === childModule.id)
          : [];

        result[`module_${moduleNo}`].quests = {};

        // Get quests from registry
        const registryModule = moduleRegistry.perModule[moduleNo];
        const questNos = registryModule
          ? Object.keys(registryModule.quests).map(Number)
          : [];

        for (const questNo of questNos) {
          const prevQuest =
            questNo > 1 ? quests.find((q) => q.questNo === questNo - 1) : null;
          const questAccessible =
            questNo === 1 || (prevQuest?.isCompleted ?? false);
          const childQuest = quests.find((q) => q.questNo === questNo);

          result[`module_${moduleNo}`].quests[`quest_${questNo}`] = {
            unlocked: moduleStatus.unlocked,
            accessible: questAccessible,
            isCompleted: childQuest?.isCompleted ?? false,
            unlockDate: moduleStatus.unlockDate,
          };

          // Add screens if quest is accessible
          if (questAccessible) {
            const screens = childQuest
              ? childScreens.filter((s) => s.questId === childQuest.id)
              : [];

            result[`module_${moduleNo}`].quests[`quest_${questNo}`].screens =
              {};

            // Get screen count from registry
            const questScreenCount =
              registryModule.quests[questNo]?.screens ?? 0;

            for (let screenNo = 1; screenNo <= questScreenCount; screenNo++) {
              const prevScreen =
                screenNo > 1
                  ? screens.find((s) => s.screenNo === screenNo - 1)
                  : null;
              const screenAccessible =
                screenNo === 1 || (prevScreen?.isCompleted ?? false);
              const childScreen = screens.find((s) => s.screenNo === screenNo);

              result[`module_${moduleNo}`].quests[`quest_${questNo}`].screens[
                `screen_${screenNo}`
              ] = {
                unlocked: moduleStatus.unlocked,
                accessible: screenAccessible,
                isCompleted: childScreen?.isCompleted ?? false,
                unlockDate: moduleStatus.unlockDate,
              };
            }
          }
        }
      }
    }

    return result;
  }

  async getProgress(userId: string, childId: string) {
    const child = await this.childRepository.findOneBy({ id: childId, userId });
    if (!child) throw new ForbiddenException("Child not found");

    // Count total screens from module registry
    let totalScreens = 0;
    for (let moduleNo = 1; moduleNo <= MAX_MODULES; moduleNo++) {
      const registryModule = moduleRegistry.perModule[moduleNo];
      if (registryModule) {
        for (const questNo of Object.keys(registryModule.quests).map(Number)) {
          const questScreenCount = registryModule.quests[questNo]?.screens ?? 0;
          totalScreens += questScreenCount;
        }
      }
    }

    // Count completed screens for this child
    const childModules = await this.childModuleRepository.findBy({ childId });
    const completedScreens =
      childModules.length > 0
        ? await this.childScreenRepository
            .createQueryBuilder("cs")
            .innerJoin("cs.quest", "cq")
            .innerJoin("cq.module", "cm")
            .where("cm.childId = :childId AND cs.isCompleted = true", { childId })
            .getCount()
        : 0;

    return {
      totalScreens,
      completedScreens,
      progressPercentage: totalScreens > 0 ? Math.round((completedScreens / totalScreens) * 100) : 0,
    };
  }
}
