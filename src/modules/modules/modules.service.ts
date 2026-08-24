import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { UserPlan } from "../subscriptions/entities/user-plan.entity";
import {
  WeeklySubscription,
  WeeklySubscriptionStatus,
} from "../subscriptions/entities/weekly-subscription.entity";
import { Child } from "../children/entities/child.entity";
import { ChildModule } from "../children/entities/child-module.entity";
import { ChildQuest } from "../children/entities/child-quest.entity";
import { ChildScreen } from "../children/entities/child-screen.entity";
import {
  FREE_ACCESS_EMAILS,
  MAX_MODULES,
  getModuleUnlockDays,
} from "../../constants/modules.constants";
import { moduleRegistry } from "../../constants/module-registry";

export type AccessStatus = {
  unlocked: boolean;
  accessible: boolean;
  unlockDate: Date | null;
  isCompleted: boolean;
  status: "initialized" | "ongoing" | "completed";
  completedAt: Date | null;
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
    @InjectRepository(WeeklySubscription)
    private readonly weeklySubscriptionRepository: Repository<WeeklySubscription>,
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
    userEmail: string,
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

    const child = await this.childRepository.findOne({
      where: { id: childId, userId },
    });
    if (!child) throw new ForbiddenException("Child not found");

    const userPlan = await this.userPlanRepository.findOne({
      where: { userId, isActive: true },
    });
    const weeklySubscription = await this.weeklySubscriptionRepository.findOne({
      where: { userId },
      order: { createdAt: "DESC" },
    });

    const baseDate = FREE_ACCESS_EMAILS.has(userEmail)
      ? new Date(Date.now() - 100 * 24 * 60 * 60 * 1000)
      : this.resolveBaseDate(userPlan ?? null, weeklySubscription ?? null);
    const unlockDays = getModuleUnlockDays(userEmail);
    const weeklyGate = FREE_ACCESS_EMAILS.has(userEmail)
      ? null
      : this.resolveWeeklyGate(userPlan ?? null, weeklySubscription ?? null);

    if (moduleNo !== undefined) {
      const prevChildModule =
        moduleNo > 1
          ? await this.childModuleRepository.findOne({
              where: {
                childId,
                moduleNo: moduleNo - 1,
              },
            })
          : null;

      const moduleStatus = this.resolveModuleStatus(
        moduleNo,
        baseDate,
        prevChildModule,
        unlockDays,
        weeklyGate,
      );

      const childModule = await this.childModuleRepository.findOne({
        where: {
          childId,
          moduleNo,
        },
      });

      if (questNo !== undefined) {
        const prevChildQuest =
          questNo > 1 && childModule
            ? await this.childQuestRepository.findOne({
                where: {
                  moduleId: childModule.id,
                  questNo: questNo - 1,
                },
              })
            : null;

        const questAccessible =
          moduleStatus.accessible &&
          (questNo === 1 || (prevChildQuest?.isCompleted ?? false));

        const childQuest = childModule
          ? await this.childQuestRepository.findOne({
              where: {
                moduleId: childModule.id,
                questNo,
              },
            })
          : null;

        if (screenNo !== undefined) {
          const prevChildScreen =
            screenNo > 1 && childQuest
              ? await this.childScreenRepository.findOne({
                  where: {
                    questId: childQuest.id,
                    screenNo: screenNo - 1,
                  },
                })
              : null;

          const screenAccessible =
            questAccessible &&
            (screenNo === 1 || (prevChildScreen?.isCompleted ?? false));

          const childScreen = childQuest
            ? await this.childScreenRepository.findOne({
                where: {
                  questId: childQuest.id,
                  screenNo,
                },
              })
            : null;

          return {
            [`module_${moduleNo}`]: {
              [`quest_${questNo}`]: {
                [`screen_${screenNo}`]: {
                  unlocked: moduleStatus.unlocked,
                  accessible: screenAccessible,
                  unlockDate: moduleStatus.unlockDate,
                  isCompleted: childScreen?.isCompleted ?? false,
                  status: accessListEntityStatus(childScreen ?? null),
                  completedAt: childScreen?.completedAt ?? null,
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
              isCompleted: childQuest?.isCompleted ?? false,
              status: accessListEntityStatus(childQuest ?? null),
              completedAt: childQuest?.completedAt ?? null,
            },
          },
        };
      }

      return {
        [`module_${moduleNo}`]: {
          ...moduleStatus,
          isCompleted: childModule?.isCompleted ?? false,
          status: accessListEntityStatus(childModule ?? null),
          completedAt: childModule?.completedAt ?? null,
        },
      };
    }

    // All modules — load child's module records in one query
    const childModules = await this.childModuleRepository.find({
      where: { childId: childId },
    });
    const moduleMap = new Map(childModules.map((m) => [m.moduleNo, m]));

    const result: AllModulesResponse = {};
    for (let i = 1; i <= MAX_MODULES; i++) {
      const prevChildModule = i > 1 ? (moduleMap.get(i - 1) ?? null) : null;
      const moduleStatus = this.resolveModuleStatus(
        i,
        baseDate,
        prevChildModule,
        unlockDays,
        weeklyGate,
      );
      const record = moduleMap.get(i) ?? null;
      result[`module_${i}`] = {
        ...moduleStatus,
        isCompleted: record?.isCompleted ?? false,
        status: accessListEntityStatus(record),
        completedAt: record?.completedAt ?? null,
      };
    }
    return result;
  }

  private resolveBaseDate(
    userPlan: UserPlan | null,
    weeklySubscription: WeeklySubscription | null,
  ): Date | null {
    const dates: Date[] = [];
    if (userPlan?.purchasedAt) dates.push(userPlan.purchasedAt);
    if (
      weeklySubscription?.startedAt &&
      (weeklySubscription.status === WeeklySubscriptionStatus.ACTIVE ||
        weeklySubscription.status === WeeklySubscriptionStatus.PAID_OFF)
    ) {
      dates.push(weeklySubscription.startedAt);
    }
    if (dates.length === 0) return null;
    return dates.reduce((earliest, d) => (d < earliest ? d : earliest));
  }

  /**
   * A weekly subscriber's content is tied to actual payments, not just
   * elapsed time — module N should only unlock once week N's charge has
   * really succeeded (cyclesPaid >= N), so a lagging/failed payment keeps
   * exactly the modules it should locked rather than everything or nothing.
   * A one-time-plan owner has no cycles, so this is null for them and the
   * pure time-based schedule in resolveModuleStatus applies instead.
   * Paying off early sets cyclesPaid = totalCycles immediately, which
   * correctly unlocks everything at once — same as a one-time purchase.
   */
  private resolveWeeklyGate(
    userPlan: UserPlan | null,
    weeklySubscription: WeeklySubscription | null,
  ): { cyclesPaid: number } | null {
    if (userPlan) return null; // one-time plan takes precedence
    if (
      !weeklySubscription ||
      (weeklySubscription.status !== WeeklySubscriptionStatus.ACTIVE &&
        weeklySubscription.status !== WeeklySubscriptionStatus.PAID_OFF)
    ) {
      return null;
    }
    return { cyclesPaid: weeklySubscription.cyclesPaid };
  }

  private resolveModuleStatus(
    moduleNo: number,
    baseDate: Date | null,
    prevChildModule: ChildModule | null,
    unlockDays: Record<number, number>,
    weeklyGate: { cyclesPaid: number } | null = null,
  ): { unlocked: boolean; accessible: boolean; unlockDate: Date | null } {
    if (!baseDate) {
      return { unlocked: false, accessible: false, unlockDate: null };
    }

    const delayDays = unlockDays[moduleNo] ?? (moduleNo - 1) * 7;
    const unlockDate = new Date(baseDate);
    unlockDate.setDate(unlockDate.getDate() + delayDays);

    // unlockDate stays time-projected either way (useful for "unlocks in N
    // days" display), but for weekly subscribers the real gate is whether
    // that week's payment has actually gone through.
    const unlocked = weeklyGate
      ? moduleNo <= weeklyGate.cyclesPaid
      : new Date() >= unlockDate;
    if (!unlocked) {
      return { unlocked: false, accessible: false, unlockDate };
    }

    const accessible =
      moduleNo === 1 ? true : (prevChildModule?.isCompleted ?? false);
    return { unlocked, accessible, unlockDate };
  }

  async getAccessList(
    userId: string,
    userEmail: string,
    childId: string,
    include: string[],
  ) {
    const child = await this.childRepository.findOne({
      where: { id: childId, userId },
    });
    if (!child) throw new ForbiddenException("Child not found");

    const includeQuest = include.includes("quest");
    const includeScreen = include.includes("screen");

    const userPlan = await this.userPlanRepository.findOne({
      where: { userId, isActive: true },
    });
    const weeklySubscription = await this.weeklySubscriptionRepository.findOne({
      where: { userId },
      order: { createdAt: "DESC" },
    });
    const baseDate = FREE_ACCESS_EMAILS.has(userEmail)
      ? new Date(Date.now() - 100 * 24 * 60 * 60 * 1000)
      : this.resolveBaseDate(userPlan ?? null, weeklySubscription ?? null);
    const unlockDays = getModuleUnlockDays(userEmail);
    const weeklyGate = FREE_ACCESS_EMAILS.has(userEmail)
      ? null
      : this.resolveWeeklyGate(userPlan ?? null, weeklySubscription ?? null);

    const childModules = await this.childModuleRepository.find({
      where: { childId: childId },
    });
    const moduleMap = new Map(childModules.map((m) => [m.moduleNo, m]));

    let childQuests: ChildQuest[] = [];
    const questsByModuleId = new Map<string, ChildQuest[]>();
    if (includeQuest || includeScreen) {
      childQuests =
        childModules.length > 0
          ? await this.childQuestRepository.find({
              where: {
                moduleId: In(childModules.map((m) => m.id)),
              },
            })
          : [];

      for (const q of childQuests) {
        const list = questsByModuleId.get(q.moduleId) ?? [];
        list.push(q);
        questsByModuleId.set(q.moduleId, list);
      }
    }

    let allScreens: ChildScreen[] = [];
    const screensByQuestId = new Map<string, ChildScreen[]>();
    if (includeScreen) {
      allScreens =
        childQuests.length > 0
          ? await this.childScreenRepository.find({
              where: { questId: In(childQuests.map((q) => q.id)) },
            })
          : [];

      for (const s of allScreens) {
        const list = screensByQuestId.get(s.questId) ?? [];
        list.push(s);
        screensByQuestId.set(s.questId, list);
      }
    }

    // --- module_list ---
    const module_list = [];
    for (let moduleNo = 1; moduleNo <= MAX_MODULES; moduleNo++) {
      const prevChildModule =
        moduleNo > 1 ? (moduleMap.get(moduleNo - 1) ?? null) : null;
      const { unlocked, accessible, unlockDate } = this.resolveModuleStatus(
        moduleNo,
        baseDate,
        prevChildModule,
        unlockDays,
        weeklyGate,
      );
      const record = moduleMap.get(moduleNo) ?? null;
      module_list.push({
        module: moduleNo,
        status: accessListEntityStatus(record),
        accessible,
        unlocked,
        unlockedAt: unlockDate,
        isCompleted: record?.isCompleted ?? false,
        completedAt: record?.completedAt ?? null,
      });
    }

    // --- quest_list (optional) ---
    let quest_list: unknown[] | undefined;
    if (includeQuest) {
      quest_list = [];
      for (let moduleNo = 1; moduleNo <= MAX_MODULES; moduleNo++) {
        const reg = moduleRegistry.perModule[moduleNo];
        if (!reg) continue;
        const prevChildModule =
          moduleNo > 1 ? (moduleMap.get(moduleNo - 1) ?? null) : null;
        const moduleStatus = this.resolveModuleStatus(
          moduleNo,
          baseDate,
          prevChildModule,
          unlockDays,
          weeklyGate,
        );
        const childModule = moduleMap.get(moduleNo);
        const quests = childModule
          ? (questsByModuleId.get(childModule.id) ?? [])
          : [];
        const questMap = new Map(quests.map((q) => [q.questNo, q]));
        const questNos = Object.keys(reg.quests)
          .map(Number)
          .sort((a, b) => a - b);
        for (const questNo of questNos) {
          const prevQuest =
            questNo > 1 ? (questMap.get(questNo - 1) ?? null) : null;
          const questAccessible =
            moduleStatus.accessible &&
            (questNo === 1 || (prevQuest?.isCompleted ?? false));
          const record = questMap.get(questNo) ?? null;
          quest_list.push({
            module: moduleNo,
            quest: questNo,
            status: accessListEntityStatus(record),
            accessible: questAccessible,
            unlocked: moduleStatus.unlocked,
            unlockedAt: moduleStatus.unlockDate,
            isCompleted: record?.isCompleted ?? false,
            completedAt: record?.completedAt ?? null,
          });
        }
      }
    }

    // --- screen_list (optional) ---
    let screen_list: unknown[] | undefined;
    if (includeScreen) {
      screen_list = [];
      for (let moduleNo = 1; moduleNo <= MAX_MODULES; moduleNo++) {
        const reg = moduleRegistry.perModule[moduleNo];
        if (!reg) continue;
        const prevChildModule =
          moduleNo > 1 ? (moduleMap.get(moduleNo - 1) ?? null) : null;
        const moduleStatus = this.resolveModuleStatus(
          moduleNo,
          baseDate,
          prevChildModule,
          unlockDays,
          weeklyGate,
        );
        const childModule = moduleMap.get(moduleNo);
        const quests = childModule
          ? (questsByModuleId.get(childModule.id) ?? [])
          : [];
        const questMap = new Map(quests.map((q) => [q.questNo, q]));
        const questNos = Object.keys(reg.quests)
          .map(Number)
          .sort((a, b) => a - b);
        for (const questNo of questNos) {
          const prevQuest =
            questNo > 1 ? (questMap.get(questNo - 1) ?? null) : null;
          const questAccessible =
            moduleStatus.accessible &&
            (questNo === 1 || (prevQuest?.isCompleted ?? false));
          const childQuest = questMap.get(questNo) ?? null;
          const screens = childQuest
            ? (screensByQuestId.get(childQuest.id) ?? [])
            : [];
          const screenMap = new Map(screens.map((s) => [s.screenNo, s]));
          const screenCount = reg.quests[questNo]?.screens ?? 0;
          for (let screenNo = 1; screenNo <= screenCount; screenNo++) {
            const prevScreen =
              screenNo > 1 ? (screenMap.get(screenNo - 1) ?? null) : null;
            const screenAccessible =
              questAccessible &&
              (screenNo === 1 || (prevScreen?.isCompleted ?? false));
            const record = screenMap.get(screenNo) ?? null;
            screen_list.push({
              module: moduleNo,
              quest: questNo,
              screen: screenNo,
              status: accessListEntityStatus(record),
              accessible: screenAccessible,
              unlocked: moduleStatus.unlocked,
              unlockedAt: moduleStatus.unlockDate,
              isCompleted: record?.isCompleted ?? false,
              completedAt: record?.completedAt ?? null,
            });
          }
        }
      }
    }

    const result: Record<string, unknown> = { module_list };
    if (includeQuest) result.quest_list = quest_list;
    if (includeScreen) result.screen_list = screen_list;
    return result;
  }
}

function accessListEntityStatus(
  record: { isCompleted: boolean } | null | undefined,
): "initialized" | "ongoing" | "completed" {
  if (!record) return "initialized";
  return record.isCompleted ? "completed" : "ongoing";
}
