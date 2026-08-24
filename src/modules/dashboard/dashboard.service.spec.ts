import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ForbiddenException } from "@nestjs/common";
import { DashboardService } from "./dashboard.service";
import { Child } from "../children/entities/child.entity";
import { ChildModule } from "../children/entities/child-module.entity";
import { ChildQuest } from "../children/entities/child-quest.entity";
import { ChildScreen } from "../children/entities/child-screen.entity";
import { UserPlan } from "../subscriptions/entities/user-plan.entity";
import { WeeklySubscription } from "../subscriptions/entities/weekly-subscription.entity";

jest.mock("../../constants/module-registry", () => ({
  moduleRegistry: {
    perModule: {
      1: {
        quests: {
          1: { screens: 1 },
          2: { screens: 1 },
          3: { screens: 1 },
          4: { screens: 3 },
          5: { screens: 3 },
          6: { screens: 1 },
          7: { screens: 2 },
        },
      },
      2: {
        quests: {
          1: { screens: 2 },
          2: { screens: 1 },
          3: { screens: 1 },
          4: { screens: 1 },
          5: { screens: 1 },
          6: { screens: 2 },
        },
      },
      3: {
        quests: {
          1: { screens: 2 },
          2: { screens: 1 },
          3: { screens: 2 },
          4: { screens: 2 },
          5: { screens: 2 },
        },
      },
      4: {
        quests: {
          1: { screens: 2 },
          2: { screens: 3 },
          3: { screens: 2 },
          4: { screens: 3 },
          5: { screens: 3 },
          6: { screens: 2 },
        },
      },
      5: {
        quests: {
          1: { screens: 2 },
          2: { screens: 3 },
          3: { screens: 4 },
          4: { screens: 0 },
          5: { screens: 0 },
          6: { screens: 0 },
        },
      },
      6: {
        quests: {
          1: { screens: 0 },
          2: { screens: 0 },
          3: { screens: 0 },
          4: { screens: 0 },
          5: { screens: 0 },
          6: { screens: 0 },
        },
      },
    },
  },
}));

jest.mock("../../constants/modules.constants", () => ({
  MAX_MODULES: 6,
  MODULE_UNLOCK_DAYS: { 1: 0, 2: 0, 3: 14, 4: 28, 5: 42, 6: 56 },
}));

const createMockRepository = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  findBy: jest.fn(),
  findOneBy: jest.fn(),
  save: jest.fn(),
  create: jest.fn().mockImplementation((data) => data),
  update: jest.fn(),
  delete: jest.fn(),
  countBy: jest.fn(),
  count: jest.fn(),
});

describe("DashboardService", () => {
  let service: DashboardService;

  let childRepo: ReturnType<typeof createMockRepository>;
  let childModuleRepo: ReturnType<typeof createMockRepository>;
  let childQuestRepo: ReturnType<typeof createMockRepository>;
  let childScreenRepo: ReturnType<typeof createMockRepository>;
  let userPlanRepo: ReturnType<typeof createMockRepository>;
  let weeklySubscriptionRepo: ReturnType<typeof createMockRepository>;

  const userId = "user-uuid-1";
  const childId = "child-uuid-1";

  const mockChild = {
    id: childId,
    userId,
    name: "Test Child",
    age: 7,
    gender: "male",
  };

  const makeModule = (
    moduleNo: number,
    isCompleted = false,
    id = `cm-${moduleNo}`,
  ) =>
    ({
      id,
      childId,
      moduleNo,
      isCompleted,
      completedAt: isCompleted ? new Date() : null,
    }) as ChildModule;

  const makeQuest = (
    questNo: number,
    moduleId: string,
    isCompleted = false,
    id = `cq-${questNo}`,
  ) =>
    ({
      id,
      moduleId,
      questNo,
      isCompleted,
      completedAt: isCompleted ? new Date() : null,
    }) as ChildQuest;

  const makeScreen = (
    screenNo: number,
    questId: string,
    isCompleted = false,
    data: Record<string, unknown> | null = null,
    id = `cs-${screenNo}`,
  ) =>
    ({
      id,
      questId,
      screenNo,
      isCompleted,
      completedAt: isCompleted ? new Date() : null,
      data,
    }) as ChildScreen;

  beforeEach(async () => {
    childRepo = createMockRepository();
    childModuleRepo = createMockRepository();
    childQuestRepo = createMockRepository();
    childScreenRepo = createMockRepository();
    userPlanRepo = createMockRepository();
    weeklySubscriptionRepo = createMockRepository();
    weeklySubscriptionRepo.findOne.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: getRepositoryToken(Child), useValue: childRepo },
        { provide: getRepositoryToken(ChildModule), useValue: childModuleRepo },
        { provide: getRepositoryToken(ChildQuest), useValue: childQuestRepo },
        { provide: getRepositoryToken(ChildScreen), useValue: childScreenRepo },
        { provide: getRepositoryToken(UserPlan), useValue: userPlanRepo },
        {
          provide: getRepositoryToken(WeeklySubscription),
          useValue: weeklySubscriptionRepo,
        },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // getDashboard — validation
  // -----------------------------------------------------------------------
  describe("getDashboard — validation", () => {
    it("throws ForbiddenException when child is not found", async () => {
      childRepo.findOne.mockResolvedValue(null);

      await expect(service.getDashboard(userId, childId, [])).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // -----------------------------------------------------------------------
  // getDashboard — response shape
  // -----------------------------------------------------------------------
  describe("getDashboard — response shape", () => {
    beforeEach(() => {
      childRepo.findOne.mockResolvedValue(mockChild);
      userPlanRepo.findOne.mockResolvedValue(null);
      childModuleRepo.find.mockResolvedValue([]);
      childQuestRepo.find.mockResolvedValue([]);
      childScreenRepo.find.mockResolvedValue([]);
    });

    it("returns brain_data, tactile_data, milestone, progress, module_progress", async () => {
      const result = await service.getDashboard(userId, childId, []);

      expect(result).toHaveProperty("brain_data");
      expect(result).toHaveProperty("tactile_data");
      expect(result).toHaveProperty("milestone");
      expect(result).toHaveProperty("progress");
      expect(result).toHaveProperty("module_progress");
    });

    it("does not include quest_progress or screen_progress when include is empty", async () => {
      const result = await service.getDashboard(userId, childId, []);

      expect(result).not.toHaveProperty("quest_progress");
      expect(result).not.toHaveProperty("screen_progress");
      expect(result).not.toHaveProperty("hierarchy");
    });

    it("includes quest_progress when include=['quest']", async () => {
      const result = await service.getDashboard(userId, childId, ["quest"]);

      expect(result).toHaveProperty("quest_progress");
      expect(result).toHaveProperty("hierarchy");
      expect(result).not.toHaveProperty("screen_progress");
    });

    it("includes both quest_progress and screen_progress when include=['quest','screen']", async () => {
      const result = await service.getDashboard(userId, childId, [
        "quest",
        "screen",
      ]);

      expect(result).toHaveProperty("quest_progress");
      expect(result).toHaveProperty("screen_progress");
      expect(result).toHaveProperty("hierarchy");
    });

    it("returns 6 entries in module_progress", async () => {
      const result = (await service.getDashboard(userId, childId, [])) as any;

      expect(result.module_progress).toHaveLength(6);
    });

    it("module_1 in module_progress is locked when no user plan exists", async () => {
      const result = (await service.getDashboard(userId, childId, [])) as any;

      const module1 = result.module_progress.find((m: any) => m.module === 1);
      expect(module1.accessible).toBe(false);
      expect(module1.unlocked).toBe(false);
    });

    it("all modules 1-6 are locked when no user plan exists", async () => {
      const result = (await service.getDashboard(userId, childId, [])) as any;

      for (let i = 1; i <= 6; i++) {
        const m = result.module_progress.find((mod: any) => mod.module === i);
        expect(m.unlocked).toBe(false);
        expect(m.accessible).toBe(false);
      }
    });
  });

  // -----------------------------------------------------------------------
  // getDashboard — progress counts
  // -----------------------------------------------------------------------
  describe("getDashboard — progress counts", () => {
    it("returns correct total module count (6)", async () => {
      childRepo.findOne.mockResolvedValue(mockChild);
      userPlanRepo.findOne.mockResolvedValue(null);
      childModuleRepo.find.mockResolvedValue([]);
      childQuestRepo.find.mockResolvedValue([]);
      childScreenRepo.find.mockResolvedValue([]);

      const result = (await service.getDashboard(userId, childId, [])) as any;

      expect(result.progress.modules.total).toBe(6);
    });

    it("returns 0 completed modules when no records exist", async () => {
      childRepo.findOne.mockResolvedValue(mockChild);
      userPlanRepo.findOne.mockResolvedValue(null);
      childModuleRepo.find.mockResolvedValue([]);
      childQuestRepo.find.mockResolvedValue([]);
      childScreenRepo.find.mockResolvedValue([]);

      const result = (await service.getDashboard(userId, childId, [])) as any;

      expect(result.progress.modules.completed).toBe(0);
      expect(result.progress.quests.completed).toBe(0);
      expect(result.progress.screens.completed).toBe(0);
    });

    it("counts completed modules correctly", async () => {
      childRepo.findOne.mockResolvedValue(mockChild);
      userPlanRepo.findOne.mockResolvedValue(null);

      const completedModule = makeModule(1, true);
      childModuleRepo.find.mockResolvedValue([completedModule]);

      const quests = [
        makeQuest(1, completedModule.id, true),
        makeQuest(2, completedModule.id, true),
        makeQuest(3, completedModule.id, true),
        makeQuest(4, completedModule.id, true),
        makeQuest(5, completedModule.id, true),
        makeQuest(6, completedModule.id, true),
        makeQuest(7, completedModule.id, true),
      ];
      childQuestRepo.find.mockResolvedValue(quests);
      childScreenRepo.find.mockResolvedValue([]);

      const result = (await service.getDashboard(userId, childId, [])) as any;

      expect(result.progress.modules.completed).toBe(1);
      expect(result.progress.quests.completed).toBe(7);
    });

    it("returns 0% module progress percentage when no modules are complete", async () => {
      childRepo.findOne.mockResolvedValue(mockChild);
      userPlanRepo.findOne.mockResolvedValue(null);
      childModuleRepo.find.mockResolvedValue([]);
      childQuestRepo.find.mockResolvedValue([]);
      childScreenRepo.find.mockResolvedValue([]);

      const result = (await service.getDashboard(userId, childId, [])) as any;

      expect(result.progress.moduleProgressPercentage).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // getDashboard — milestones
  // -----------------------------------------------------------------------
  describe("getDashboard — milestones", () => {
    it("all milestone flags are false when no modules are completed", async () => {
      childRepo.findOne.mockResolvedValue(mockChild);
      userPlanRepo.findOne.mockResolvedValue(null);
      childModuleRepo.find.mockResolvedValue([]);
      childQuestRepo.find.mockResolvedValue([]);
      childScreenRepo.find.mockResolvedValue([]);

      const result = (await service.getDashboard(userId, childId, [])) as any;

      expect(result.milestone.halfway_explored).toBe(false);
      expect(result.milestone.toolkit_builder).toBe(false);
      expect(result.milestone.finished_the_journey).toBe(false);
    });

    it("halfway_explored is true when module 3 is completed", async () => {
      childRepo.findOne.mockResolvedValue(mockChild);
      userPlanRepo.findOne.mockResolvedValue(null);

      const m3 = makeModule(3, true);
      childModuleRepo.find.mockResolvedValue([m3]);
      childQuestRepo.find.mockResolvedValue([]);
      childScreenRepo.find.mockResolvedValue([]);

      const result = (await service.getDashboard(userId, childId, [])) as any;

      expect(result.milestone.halfway_explored).toBe(true);
    });

    it("toolkit_builder is true when module 5 is completed", async () => {
      childRepo.findOne.mockResolvedValue(mockChild);
      userPlanRepo.findOne.mockResolvedValue(null);

      const m5 = makeModule(5, true);
      childModuleRepo.find.mockResolvedValue([m5]);
      childQuestRepo.find.mockResolvedValue([]);
      childScreenRepo.find.mockResolvedValue([]);

      const result = (await service.getDashboard(userId, childId, [])) as any;

      expect(result.milestone.toolkit_builder).toBe(true);
    });

    it("finished_the_journey is true when module 6 is completed", async () => {
      childRepo.findOne.mockResolvedValue(mockChild);
      userPlanRepo.findOne.mockResolvedValue(null);

      const m6 = makeModule(6, true);
      childModuleRepo.find.mockResolvedValue([m6]);
      childQuestRepo.find.mockResolvedValue([]);
      childScreenRepo.find.mockResolvedValue([]);

      const result = (await service.getDashboard(userId, childId, [])) as any;

      expect(result.milestone.finished_the_journey).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // getDashboard — brain_data (resolveBrainData)
  // -----------------------------------------------------------------------
  describe("getDashboard — brain_data", () => {
    it("returns pending brain_data when no module 1 record exists", async () => {
      childRepo.findOne.mockResolvedValue(mockChild);
      userPlanRepo.findOne.mockResolvedValue(null);
      childModuleRepo.find.mockResolvedValue([]);
      childQuestRepo.find.mockResolvedValue([]);
      childScreenRepo.find.mockResolvedValue([]);

      const result = (await service.getDashboard(userId, childId, [])) as any;

      expect(result.brain_data.status).toBe("pending");
      expect(result.brain_data.type).toBe("unknown");
    });

    it("returns pending brain_data when module 1 exists but quest 5 does not", async () => {
      childRepo.findOne.mockResolvedValue(mockChild);
      userPlanRepo.findOne.mockResolvedValue(null);

      const m1 = makeModule(1, false);
      childModuleRepo.find.mockResolvedValue([m1]);

      // quests 1-4 and 6-7 exist but not quest 5
      const quests = [
        makeQuest(1, m1.id),
        makeQuest(2, m1.id),
        makeQuest(3, m1.id),
        makeQuest(4, m1.id),
      ];
      childQuestRepo.find.mockResolvedValue(quests);
      childScreenRepo.find.mockResolvedValue([]);

      const result = (await service.getDashboard(userId, childId, [])) as any;

      expect(result.brain_data.status).toBe("pending");
    });

    it("returns pending brain_data when quest 5 / screen 2 has no quiz data", async () => {
      childRepo.findOne.mockResolvedValue(mockChild);
      userPlanRepo.findOne.mockResolvedValue(null);

      const m1 = makeModule(1, false);
      const q5 = makeQuest(5, m1.id, false, "cq-5");
      childModuleRepo.find.mockResolvedValue([m1]);
      childQuestRepo.find.mockResolvedValue([q5]);

      // screen 2 exists but has no quiz data
      const s2 = makeScreen(2, q5.id, false, {});
      childScreenRepo.find.mockResolvedValue([s2]);

      const result = (await service.getDashboard(userId, childId, [])) as any;

      expect(result.brain_data.status).toBe("pending");
    });

    it("returns completed brain_data with correct brain type when quiz data is present", async () => {
      childRepo.findOne.mockResolvedValue(mockChild);
      userPlanRepo.findOne.mockResolvedValue(null);

      const m1 = makeModule(1, false);
      const q5 = makeQuest(5, m1.id, false, "cq-5");
      childModuleRepo.find.mockResolvedValue([m1]);
      childQuestRepo.find.mockResolvedValue([q5]);

      // All answers map to "A" (answer value 1 → "A" → "Mover")
      const quizData = {
        module_1_quest_5_screen_2_quiz_answers: {
          q1: 1,
          q2: 1,
          q3: 1,
        },
      };
      const s2 = makeScreen(2, q5.id, false, quizData, "cs-2");
      childScreenRepo.find.mockResolvedValue([s2]);

      const result = (await service.getDashboard(userId, childId, [])) as any;

      expect(result.brain_data.status).toBe("completed");
      expect(result.brain_data.type).toBe("The Mover Brain");
      expect(result.brain_data.counts.A).toBe(3);
    });

    it("returns combo brain type when there is a tie", async () => {
      childRepo.findOne.mockResolvedValue(mockChild);
      userPlanRepo.findOne.mockResolvedValue(null);

      const m1 = makeModule(1, false);
      const q5 = makeQuest(5, m1.id, false, "cq-5");
      childModuleRepo.find.mockResolvedValue([m1]);
      childQuestRepo.find.mockResolvedValue([q5]);

      // 1 answer for A (1→A) and 1 answer for B (2→B)
      const quizData = {
        module_1_quest_5_screen_2_quiz_answers: {
          q1: 1,
          q2: 2,
        },
      };
      const s2 = makeScreen(2, q5.id, false, quizData, "cs-2");
      childScreenRepo.find.mockResolvedValue([s2]);

      const result = (await service.getDashboard(userId, childId, [])) as any;

      expect(result.brain_data.status).toBe("completed");
      expect(result.brain_data.type).toContain("Combo");
    });
  });

  // -----------------------------------------------------------------------
  // getDashboard — tactile_data (resolveTactileData)
  // -----------------------------------------------------------------------
  describe("getDashboard — tactile_data", () => {
    it("returns pending tactile_data when no module 4 record exists", async () => {
      childRepo.findOne.mockResolvedValue(mockChild);
      userPlanRepo.findOne.mockResolvedValue(null);
      childModuleRepo.find.mockResolvedValue([]);
      childQuestRepo.find.mockResolvedValue([]);
      childScreenRepo.find.mockResolvedValue([]);

      const result = (await service.getDashboard(userId, childId, [])) as any;

      expect(result.tactile_data.status).toBe("pending");
      expect(result.tactile_data.type).toBe("unknown");
    });

    it("returns completed tactile_data with correct type when quiz data is present", async () => {
      childRepo.findOne.mockResolvedValue(mockChild);
      userPlanRepo.findOne.mockResolvedValue(null);

      const m4 = makeModule(4, false, "cm-4");
      const q2 = makeQuest(2, m4.id, false, "cq-m4q2");
      childModuleRepo.find.mockResolvedValue([m4]);
      childQuestRepo.find.mockResolvedValue([q2]);

      // All answers map to "B" (2 → "B" → "Touch Detective")
      const quizData = {
        module_4_quest_2_screen_2_quiz_answers: {
          q1: 2,
          q2: 2,
          q3: 2,
        },
      };
      const s2 = makeScreen(2, q2.id, false, quizData, "cs-m4q2s2");
      childScreenRepo.find.mockResolvedValue([s2]);

      const result = (await service.getDashboard(userId, childId, [])) as any;

      expect(result.tactile_data.status).toBe("completed");
      expect(result.tactile_data.type).toBe("Touch Detective");
      expect(result.tactile_data.counts.B).toBe(3);
    });

    it("returns pending tactile_data when module 4 exists but quest 2 is missing", async () => {
      childRepo.findOne.mockResolvedValue(mockChild);
      userPlanRepo.findOne.mockResolvedValue(null);

      const m4 = makeModule(4, false, "cm-4");
      childModuleRepo.find.mockResolvedValue([m4]);
      // quest 2 not included
      childQuestRepo.find.mockResolvedValue([makeQuest(1, m4.id)]);
      childScreenRepo.find.mockResolvedValue([]);

      const result = (await service.getDashboard(userId, childId, [])) as any;

      expect(result.tactile_data.status).toBe("pending");
    });
  });

  // -----------------------------------------------------------------------
  // getDashboard — quest_progress shape
  // -----------------------------------------------------------------------
  describe("getDashboard — quest_progress", () => {
    it("quest_progress entries have module, quest, status, accessible, unlocked, unlockedAt fields", async () => {
      childRepo.findOne.mockResolvedValue(mockChild);
      userPlanRepo.findOne.mockResolvedValue(null);
      childModuleRepo.find.mockResolvedValue([]);
      childQuestRepo.find.mockResolvedValue([]);
      childScreenRepo.find.mockResolvedValue([]);

      const result = (await service.getDashboard(userId, childId, [
        "quest",
      ])) as any;
      const questProgress = result.quest_progress as any[];

      expect(questProgress.length).toBeGreaterThan(0);
      const first = questProgress[0];
      expect(first).toHaveProperty("module");
      expect(first).toHaveProperty("quest");
      expect(first).toHaveProperty("status");
      expect(first).toHaveProperty("accessible");
      expect(first).toHaveProperty("unlocked");
      expect(first).toHaveProperty("unlockedAt");
    });

    it("quest 1 of module 1 is locked when no user plan exists", async () => {
      childRepo.findOne.mockResolvedValue(mockChild);
      userPlanRepo.findOne.mockResolvedValue(null);
      childModuleRepo.find.mockResolvedValue([]);
      childQuestRepo.find.mockResolvedValue([]);
      childScreenRepo.find.mockResolvedValue([]);

      const result = (await service.getDashboard(userId, childId, [
        "quest",
      ])) as any;
      const questProgress = result.quest_progress as any[];

      const m1q1 = questProgress.find(
        (q: any) => q.module === 1 && q.quest === 1,
      );
      expect(m1q1.accessible).toBe(false);
      expect(m1q1.unlocked).toBe(false);
    });

    it("quest 1 of module 1 is accessible once a plan is purchased", async () => {
      childRepo.findOne.mockResolvedValue(mockChild);
      userPlanRepo.findOne.mockResolvedValue({
        purchasedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      } as any);
      childModuleRepo.find.mockResolvedValue([]);
      childQuestRepo.find.mockResolvedValue([]);
      childScreenRepo.find.mockResolvedValue([]);

      const result = (await service.getDashboard(userId, childId, [
        "quest",
      ])) as any;
      const questProgress = result.quest_progress as any[];

      const m1q1 = questProgress.find(
        (q: any) => q.module === 1 && q.quest === 1,
      );
      expect(m1q1.accessible).toBe(true);
      expect(m1q1.unlocked).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // getDashboard — hierarchy
  // -----------------------------------------------------------------------
  describe("getDashboard — hierarchy", () => {
    it("hierarchy has entries for all 6 modules when include=['quest']", async () => {
      childRepo.findOne.mockResolvedValue(mockChild);
      userPlanRepo.findOne.mockResolvedValue(null);
      childModuleRepo.find.mockResolvedValue([]);
      childQuestRepo.find.mockResolvedValue([]);
      childScreenRepo.find.mockResolvedValue([]);

      const result = (await service.getDashboard(userId, childId, [
        "quest",
      ])) as any;
      const hierarchy = result.hierarchy;

      expect(Object.keys(hierarchy)).toHaveLength(6);
    });

    it("hierarchy entries have completedQuests and totalQuests", async () => {
      childRepo.findOne.mockResolvedValue(mockChild);
      userPlanRepo.findOne.mockResolvedValue(null);
      childModuleRepo.find.mockResolvedValue([]);
      childQuestRepo.find.mockResolvedValue([]);
      childScreenRepo.find.mockResolvedValue([]);

      const result = (await service.getDashboard(userId, childId, [
        "quest",
      ])) as any;
      const hierarchy = result.hierarchy;

      expect(hierarchy["1"]).toMatchObject({
        completedQuests: 0,
        totalQuests: 7,
      });
    });

    it("hierarchy includes quest sub-entries when include=['quest','screen']", async () => {
      childRepo.findOne.mockResolvedValue(mockChild);
      userPlanRepo.findOne.mockResolvedValue(null);
      childModuleRepo.find.mockResolvedValue([]);
      childQuestRepo.find.mockResolvedValue([]);
      childScreenRepo.find.mockResolvedValue([]);

      const result = (await service.getDashboard(userId, childId, [
        "quest",
        "screen",
      ])) as any;
      const hierarchy = result.hierarchy;

      expect(hierarchy["1"]).toHaveProperty("quest");
      expect(hierarchy["1"].quest["1"]).toMatchObject({
        completedScreens: 0,
        totalScreens: 1,
      });
    });
  });
});
