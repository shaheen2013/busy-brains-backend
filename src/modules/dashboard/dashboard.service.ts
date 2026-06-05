import { ForbiddenException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { Child } from "../children/entities/child.entity";
import { ChildModule } from "../children/entities/child-module.entity";
import { ChildQuest } from "../children/entities/child-quest.entity";
import { ChildScreen } from "../children/entities/child-screen.entity";
import { UserPlan } from "../subscriptions/entities/user-plan.entity";
import { moduleRegistry } from "../../constants/module-registry";
import {
  MAX_MODULES,
  MODULE_UNLOCK_DAYS,
} from "../../constants/modules.constants";

const ANSWER_MAP: Record<number, string> = { 1: "A", 2: "B", 3: "C", 4: "D" };
const BRAIN_TYPES: Record<string, string> = {
  A: "Mover",
  B: "Cozy",
  C: "Fidget",
  D: "Quiet",
};
const QUIZ_KEY = "module_1_quest_5_screen_2_quiz_answers";

const TACTILE_ANSWER_MAP: Record<number, string> = { 1: "A", 2: "B", 3: "C" };
const TACTILE_TYPES: Record<string, string> = {
  A: "Touch Explorer",
  B: "Touch Detective",
  C: "Touch on Your Terms",
};
const TACTILE_QUIZ_KEY = "module_4_quest_2_screen_2_quiz_answers";

type ProgressStatus = "initialized" | "ongoing" | "completed";

function entityStatus(
  record: { isCompleted: boolean } | null | undefined,
): ProgressStatus {
  if (!record) return "initialized";
  return record.isCompleted ? "completed" : "ongoing";
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Child)
    private readonly childRepository: Repository<Child>,
    @InjectRepository(ChildModule)
    private readonly childModuleRepository: Repository<ChildModule>,
    @InjectRepository(ChildQuest)
    private readonly childQuestRepository: Repository<ChildQuest>,
    @InjectRepository(ChildScreen)
    private readonly childScreenRepository: Repository<ChildScreen>,
    @InjectRepository(UserPlan)
    private readonly userPlanRepository: Repository<UserPlan>,
  ) {}

  async getDashboard(userId: string, childId: string, include: string[]) {
    const child = await this.childRepository.findOne({
      where: { id: childId, userId },
    });
    if (!child) throw new ForbiddenException("Child not found");

    const includeQuests = include.includes("quest");
    const includeScreens = include.includes("screen");

    const userPlan = await this.userPlanRepository.findOne({
      where: { userId, isActive: true },
    });
    const baseDate = this.resolveBaseDate(userPlan ?? null);

    // Fetch all child progress records
    const childModules = await this.childModuleRepository.find({
      where: { childId: childId },
    });
    const moduleMap = new Map(childModules.map((m) => [m.moduleNo, m]));

    const childQuests =
      childModules.length > 0
        ? await this.childQuestRepository.find({
            where: { moduleId: In(childModules.map((m) => m.id)) },
          })
        : [];

    const questsByModuleId = new Map<string, ChildQuest[]>();
    for (const q of childQuests) {
      const list = questsByModuleId.get(q.moduleId) ?? [];
      list.push(q);
      questsByModuleId.set(q.moduleId, list);
    }

    // Screens — only fetch records if needed for screen_progress; always need count
    let allScreens: ChildScreen[] = [];
    if (childQuests.length > 0) {
      allScreens = await this.childScreenRepository.find({
        where: { questId: In(childQuests.map((q) => q.id)) },
      });
    }
    const screensByQuestId = new Map<string, ChildScreen[]>();
    for (const s of allScreens) {
      const list = screensByQuestId.get(s.questId) ?? [];
      list.push(s);
      screensByQuestId.set(s.questId, list);
    }

    // --- Progress counts ---
    let totalModules = 0;
    let totalQuests = 0;
    let totalScreens = 0;
    for (let m = 1; m <= MAX_MODULES; m++) {
      totalModules++;
      const reg = moduleRegistry.perModule[m];
      if (!reg) continue;
      const questNos = Object.keys(reg.quests).map(Number);
      totalQuests += questNos.length;
      for (const qn of questNos) {
        totalScreens += reg.quests[qn]?.screens ?? 0;
      }
    }

    let completedModules = 0;
    for (let moduleNo = 1; moduleNo <= MAX_MODULES; moduleNo++) {
      const m = moduleMap.get(moduleNo);
      if (m?.isCompleted) completedModules++;
    }

    let completedQuests = 0;

    for (let moduleNo = 1; moduleNo <= MAX_MODULES; moduleNo++) {
      const reg = moduleRegistry.perModule[moduleNo];
      if (!reg) continue;

      const childModule = moduleMap.get(moduleNo);
      const quests = childModule
        ? (questsByModuleId.get(childModule.id) ?? [])
        : [];

      const questMap = new Map(quests.map((q) => [q.questNo, q]));

      const questNos = Object.keys(reg.quests).map(Number);

      for (const questNo of questNos) {
        const q = questMap.get(questNo);
        if (q?.isCompleted) completedQuests++;
      }
    }

    let completedScreens = 0;

    for (let moduleNo = 1; moduleNo <= MAX_MODULES; moduleNo++) {
      const reg = moduleRegistry.perModule[moduleNo];
      if (!reg) continue;

      const childModule = moduleMap.get(moduleNo);
      const quests = childModule
        ? (questsByModuleId.get(childModule.id) ?? [])
        : [];

      const questMap = new Map(quests.map((q) => [q.questNo, q]));

      const questNos = Object.keys(reg.quests).map(Number);

      for (const questNo of questNos) {
        const childQuest = questMap.get(questNo);
        const screens = childQuest
          ? (screensByQuestId.get(childQuest.id) ?? [])
          : [];

        const screenMap = new Map(screens.map((s) => [s.screenNo, s]));

        const screenCount = reg.quests[questNo]?.screens ?? 0;

        for (let screenNo = 1; screenNo <= screenCount; screenNo++) {
          const s = screenMap.get(screenNo);
          if (s?.isCompleted) completedScreens++;
        }
      }
    }

    // --- module_progress ---
    const module_progress: {
      module: number;
      status: ProgressStatus;
      accessible: boolean;
      unlocked: boolean;
      unlockedAt: Date | null;
    }[] = [];

    for (let moduleNo = 1; moduleNo <= MAX_MODULES; moduleNo++) {
      const prevChildModule =
        moduleNo > 1 ? (moduleMap.get(moduleNo - 1) ?? null) : null;
      const { unlocked, accessible, unlockDate } = this.resolveModuleStatus(
        moduleNo,
        baseDate,
        prevChildModule,
      );
      const record = moduleMap.get(moduleNo) ?? null;
      module_progress.push({
        module: moduleNo,
        status: entityStatus(record),
        accessible,
        unlocked,
        unlockedAt: unlockDate,
      });
    }

    // --- quest_progress (optional) ---
    let quest_progress:
      | {
          module: number;
          quest: number;
          status: ProgressStatus;
          accessible: boolean;
          unlocked: boolean;
          unlockedAt: Date | null;
        }[]
      | undefined;

    if (includeQuests) {
      quest_progress = [];
      for (let moduleNo = 1; moduleNo <= MAX_MODULES; moduleNo++) {
        const reg = moduleRegistry.perModule[moduleNo];
        if (!reg) continue;

        const prevChildModule =
          moduleNo > 1 ? (moduleMap.get(moduleNo - 1) ?? null) : null;
        const moduleStatus = this.resolveModuleStatus(
          moduleNo,
          baseDate,
          prevChildModule,
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
            moduleStatus.unlocked &&
            (questNo === 1 || (prevQuest?.isCompleted ?? false));
          const record = questMap.get(questNo) ?? null;
          quest_progress.push({
            module: moduleNo,
            quest: questNo,
            status: entityStatus(record),
            accessible: questAccessible,
            unlocked: moduleStatus.unlocked,
            unlockedAt: moduleStatus.unlockDate,
          });
        }
      }
    }

    // --- screen_progress (optional) ---
    let screen_progress:
      | {
          module: number;
          quest: number;
          screen: number;
          status: ProgressStatus;
          accessible: boolean;
          unlocked: boolean;
          unlockedAt: Date | null;
        }[]
      | undefined;

    if (includeScreens) {
      screen_progress = [];
      for (let moduleNo = 1; moduleNo <= MAX_MODULES; moduleNo++) {
        const reg = moduleRegistry.perModule[moduleNo];
        if (!reg) continue;

        const prevChildModule =
          moduleNo > 1 ? (moduleMap.get(moduleNo - 1) ?? null) : null;
        const moduleStatus = this.resolveModuleStatus(
          moduleNo,
          baseDate,
          prevChildModule,
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
            moduleStatus.unlocked &&
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
            screen_progress.push({
              module: moduleNo,
              quest: questNo,
              screen: screenNo,
              status: entityStatus(record),
              accessible: screenAccessible,
              unlocked: moduleStatus.unlocked,
              unlockedAt: moduleStatus.unlockDate,
            });
          }
        }
      }
    }

    // --- Brain data ---
    const brainData = await this.resolveBrainData(
      childModules,
      questsByModuleId,
      screensByQuestId,
    );

    // --- Tactile data ---
    const tactileData = await this.resolveTactileData(
      childModules,
      questsByModuleId,
      screensByQuestId,
    );

    // --- Module 5 data ---
    const favouriteToolsData = this.resolveScreenData(
      childModules,
      questsByModuleId,
      screensByQuestId,
      5,
      1,
      2,
    );

    const realLifeToolsData = this.resolveScreenData(
      childModules,
      questsByModuleId,
      screensByQuestId,
      5,
      2,
      2,
    );

    const finalToolkitData = this.resolveScreenData(
      childModules,
      questsByModuleId,
      screensByQuestId,
      5,
      3,
      3,
    );

    // Build hierarchy gated on include flags
    let hierarchy:
      | Record<
          string,
          {
            completedQuests: number;
            totalQuests: number;
            quest?: Record<
              string,
              { completedScreens: number; totalScreens: number }
            >;
          }
        >
      | undefined;

    if (includeQuests) {
      hierarchy = {};

      for (let moduleNo = 1; moduleNo <= MAX_MODULES; moduleNo++) {
        const reg = moduleRegistry.perModule[moduleNo];
        if (!reg) continue;

        const childModule = moduleMap.get(moduleNo);
        const quests = childModule
          ? (questsByModuleId.get(childModule.id) ?? [])
          : [];

        const questMap = new Map(quests.map((q) => [q.questNo, q]));
        const questNos = Object.keys(reg.quests).map(Number);

        let completedQuests = 0;

        let questHierarchy:
          | Record<string, { completedScreens: number; totalScreens: number }>
          | undefined;

        if (includeScreens) {
          questHierarchy = {};
        }

        for (const questNo of questNos) {
          const childQuest = questMap.get(questNo);

          if (childQuest?.isCompleted) completedQuests++;

          if (includeScreens) {
            const totalScreens = reg.quests[questNo]?.screens ?? 0;

            const screens = childQuest
              ? (screensByQuestId.get(childQuest.id) ?? [])
              : [];

            const screenMap = new Map(screens.map((s) => [s.screenNo, s]));

            let completedScreens = 0;

            for (let screenNo = 1; screenNo <= totalScreens; screenNo++) {
              const s = screenMap.get(screenNo);
              if (s?.isCompleted) completedScreens++;
            }

            questHierarchy[String(questNo)] = {
              completedScreens,
              totalScreens,
            };
          }
        }

        hierarchy[String(moduleNo)] = {
          completedQuests,
          totalQuests: questNos.length,
          ...(questHierarchy && { quest: questHierarchy }),
        };
      }
    }

    // --- Milestone flags ---
    const milestone = {
      halfway_explored: moduleMap.get(3)?.isCompleted ?? false,
      toolkit_builder: moduleMap.get(5)?.isCompleted ?? false,
      finished_the_journey: moduleMap.get(6)?.isCompleted ?? false,
    };

    const result: Record<string, unknown> = {
      brain_data: brainData,
      tactile_data: tactileData,
      favourite_tools_data: favouriteToolsData,
      real_life_tools_data: realLifeToolsData,
      final_toolkit_data: finalToolkitData,
      milestone,
      progress: {
        modules: { completed: completedModules, total: totalModules },
        quests: { completed: completedQuests, total: totalQuests },
        screens: { completed: completedScreens, total: totalScreens },
        moduleProgressPercentage: Math.round(
          (completedModules / totalModules) * 100,
        ),
        questProgressPercentage: Math.round(
          (completedQuests / totalQuests) * 100,
        ),
        screenProgressPercentage:
          totalScreens > 0
            ? Math.round((completedScreens / totalScreens) * 100)
            : 0,
      },
      module_progress,
    };

    if (includeQuests) result.quest_progress = quest_progress;
    if (includeScreens) result.screen_progress = screen_progress;
    if (hierarchy !== undefined) result.hierarchy = hierarchy;

    return result;
  }

  private async resolveBrainData(
    childModules: ChildModule[],
    questsByModuleId: Map<string, ChildQuest[]>,
    screensByQuestId: Map<string, ChildScreen[]>,
  ) {
    const empty = {
      status: "pending" as const,
      type: "unknown",
      answers: {},
      counts: { A: 0, B: 0, C: 0, D: 0 },
    };

    const module1 = childModules.find((m) => m.moduleNo === 1);
    if (!module1) return empty;

    const quest5 = (questsByModuleId.get(module1.id) ?? []).find(
      (q) => q.questNo === 5,
    );
    if (!quest5) return empty;

    const screen2 = (screensByQuestId.get(quest5.id) ?? []).find(
      (s) => s.screenNo === 2,
    );
    if (!screen2?.data?.[QUIZ_KEY]) return empty;

    const rawAnswers = screen2.data[QUIZ_KEY] as Record<string, number>;
    const counts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };

    for (const val of Object.values(rawAnswers)) {
      const letter = ANSWER_MAP[val];
      if (letter) counts[letter]++;
    }

    const maxCount = Math.max(...Object.values(counts));
    const winners = Object.entries(counts)
      .filter(([, c]) => c === maxCount)
      .map(([k]) => k)
      .sort();

    const brainType = winners.map((k) => BRAIN_TYPES[k]).join(" + ");
    const type =
      winners.length === 1
        ? `The ${brainType} Brain`
        : `${brainType} Brain Combo`;

    return { status: "completed" as const, type, answers: rawAnswers, counts };
  }

  private async resolveTactileData(
    childModules: ChildModule[],
    questsByModuleId: Map<string, ChildQuest[]>,
    screensByQuestId: Map<string, ChildScreen[]>,
  ) {
    const empty = {
      status: "pending" as const,
      type: "unknown",
      answers: {},
      counts: { A: 0, B: 0, C: 0 },
    };

    const module4 = childModules.find((m) => m.moduleNo === 4);
    if (!module4) return empty;

    const quest2 = (questsByModuleId.get(module4.id) ?? []).find(
      (q) => q.questNo === 2,
    );
    if (!quest2) return empty;

    const screen2 = (screensByQuestId.get(quest2.id) ?? []).find(
      (s) => s.screenNo === 2,
    );
    if (!screen2?.data?.[TACTILE_QUIZ_KEY]) return empty;

    const rawAnswers = screen2.data[TACTILE_QUIZ_KEY] as Record<string, number>;
    const counts: Record<string, number> = { A: 0, B: 0, C: 0 };

    for (const val of Object.values(rawAnswers)) {
      const letter = TACTILE_ANSWER_MAP[val];
      if (letter) counts[letter]++;
    }

    const maxCount = Math.max(...Object.values(counts));
    const winners = Object.entries(counts)
      .filter(([, c]) => c === maxCount)
      .map(([k]) => k)
      .sort();

    const tactileType = winners.map((k) => TACTILE_TYPES[k]).join(" + ");
    const type = winners.length === 1 ? tactileType : `${tactileType} Combo`;

    return { status: "completed" as const, type, answers: rawAnswers, counts };
  }

  private resolveScreenData(
    childModules: ChildModule[],
    questsByModuleId: Map<string, ChildQuest[]>,
    screensByQuestId: Map<string, ChildScreen[]>,
    moduleNo: number,
    questNo: number,
    screenNo: number,
  ) {
    const empty = { status: "pending" as const, data: null };

    const childModule = childModules.find((m) => m.moduleNo === moduleNo);
    if (!childModule) return empty;

    const quest = (questsByModuleId.get(childModule.id) ?? []).find(
      (q) => q.questNo === questNo,
    );
    if (!quest) return empty;

    const screen = (screensByQuestId.get(quest.id) ?? []).find(
      (s) => s.screenNo === screenNo,
    );
    if (!screen?.data) return empty;

    return { status: "completed" as const, data: screen.data };
  }

  private resolveBaseDate(userPlan: UserPlan | null): Date | null {
    if (!userPlan?.purchasedAt) return null;
    const purchaseBase = userPlan.purchasedAt;
    return purchaseBase;
  }

  private resolveModuleStatus(
    moduleNo: number,
    baseDate: Date | null,
    prevChildModule: ChildModule | null,
  ) {
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
    if (!unlocked) return { unlocked: false, accessible: false, unlockDate };
    const accessible = prevChildModule?.isCompleted ?? false;
    return { unlocked, accessible, unlockDate };
  }
}
