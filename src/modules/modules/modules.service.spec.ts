import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { ModulesService } from "./modules.service";
import { UserPlan } from "../subscriptions/entities/user-plan.entity";
import { Child } from "../children/entities/child.entity";
import { ChildModule } from "../children/entities/child-module.entity";
import { ChildQuest } from "../children/entities/child-quest.entity";
import { ChildScreen } from "../children/entities/child-screen.entity";

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
  FREE_ACCESS_EMAILS: new Set(),
  MODULE2_INSTANT_UNLOCK_EMAILS: new Set(),
  getModuleUnlockDays: () => ({ 1: 0, 2: 0, 3: 14, 4: 28, 5: 42, 6: 56 }),
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

describe("ModulesService", () => {
  let service: ModulesService;

  let userPlanRepo: ReturnType<typeof createMockRepository>;
  let childRepo: ReturnType<typeof createMockRepository>;
  let childModuleRepo: ReturnType<typeof createMockRepository>;
  let childQuestRepo: ReturnType<typeof createMockRepository>;
  let childScreenRepo: ReturnType<typeof createMockRepository>;

  const userId = "user-uuid-1";
  const userEmail = "test@example.com";
  const childId = "child-uuid-1";

  const mockChild = {
    id: childId,
    userId,
    name: "Test Child",
    age: 7,
    gender: "male",
  };

  beforeEach(async () => {
    userPlanRepo = createMockRepository();
    childRepo = createMockRepository();
    childModuleRepo = createMockRepository();
    childQuestRepo = createMockRepository();
    childScreenRepo = createMockRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModulesService,
        { provide: getRepositoryToken(UserPlan), useValue: userPlanRepo },
        { provide: getRepositoryToken(Child), useValue: childRepo },
        { provide: getRepositoryToken(ChildModule), useValue: childModuleRepo },
        { provide: getRepositoryToken(ChildQuest), useValue: childQuestRepo },
        { provide: getRepositoryToken(ChildScreen), useValue: childScreenRepo },
      ],
    }).compile();

    service = module.get<ModulesService>(ModulesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // getAccessStatus — validation
  // -----------------------------------------------------------------------
  describe("getAccessStatus — validation", () => {
    it("throws BadRequestException when screen is given without module", async () => {
      await expect(
        service.getAccessStatus(
          userId,
          userEmail,
          childId,
          undefined,
          undefined,
          1,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws BadRequestException when screen is given without quest", async () => {
      await expect(
        service.getAccessStatus(userId, userEmail, childId, 1, undefined, 2),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws BadRequestException when quest is given without module", async () => {
      await expect(
        service.getAccessStatus(
          userId,
          userEmail,
          childId,
          undefined,
          1,
          undefined,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws ForbiddenException when child is not found", async () => {
      childRepo.findOne.mockResolvedValue(null);

      await expect(
        service.getAccessStatus(userId, userEmail, childId, 1),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // -----------------------------------------------------------------------
  // getAccessStatus — module 1 requires a purchased plan like other modules
  // -----------------------------------------------------------------------
  describe("getAccessStatus — module 1", () => {
    beforeEach(() => {
      childRepo.findOne.mockResolvedValue(mockChild);
      userPlanRepo.findOne.mockResolvedValue(null);
      childModuleRepo.findOne.mockResolvedValue(null);
    });

    it("returns module_1 as locked and inaccessible without a purchased plan", async () => {
      const result = await service.getAccessStatus(
        userId,
        userEmail,
        childId,
        1,
      );

      expect(result).toMatchObject({
        module_1: {
          unlocked: false,
          accessible: false,
          unlockDate: null,
        },
      });
    });

    it("returns module_1 as unlocked and accessible once a plan is purchased", async () => {
      userPlanRepo.findOne.mockResolvedValue({
        id: "up-1",
        userId,
        isActive: true,
        purchasedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      });

      const result = await service.getAccessStatus(
        userId,
        userEmail,
        childId,
        1,
      );

      expect(result).toMatchObject({
        module_1: {
          unlocked: true,
          accessible: true,
        },
      });
    });

    it("returns module_1 as not completed when no ChildModule record exists", async () => {
      const result = (await service.getAccessStatus(
        userId,
        userEmail,
        childId,
        1,
      )) as any;
      expect(result.module_1.isCompleted).toBe(false);
    });

    it("returns module_1 as completed when ChildModule record is completed", async () => {
      childModuleRepo.findOne.mockResolvedValue({
        id: "cm-1",
        moduleNo: 1,
        isCompleted: true,
        completedAt: new Date(),
      });

      const result = (await service.getAccessStatus(
        userId,
        userEmail,
        childId,
        1,
      )) as any;
      expect(result.module_1.isCompleted).toBe(true);
      expect(result.module_1.status).toBe("completed");
    });
  });

  // -----------------------------------------------------------------------
  // getAccessStatus — modules 2+ require baseDate and previous module complete
  // -----------------------------------------------------------------------
  describe("getAccessStatus — modules 2+", () => {
    it("returns module_2 as locked when no userPlan (no baseDate)", async () => {
      childRepo.findOne.mockResolvedValue(mockChild);
      userPlanRepo.findOne.mockResolvedValue(null);

      const result = (await service.getAccessStatus(
        userId,
        userEmail,
        childId,
        2,
      )) as any;

      expect(result.module_2.unlocked).toBe(false);
      expect(result.module_2.accessible).toBe(false);
      expect(result.module_2.unlockDate).toBeNull();
    });

    it("returns module_2 as unlocked but inaccessible when baseDate set but prev module not completed", async () => {
      const pastDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      childRepo.findOne.mockResolvedValue(mockChild);
      userPlanRepo.findOne.mockResolvedValue({
        id: "up-1",
        userId,
        isActive: true,
        purchasedAt: pastDate,
      });
      // prev module (1) not completed
      childModuleRepo.findOne.mockResolvedValue({
        id: "cm-1",
        moduleNo: 1,
        isCompleted: false,
      });

      const result = (await service.getAccessStatus(
        userId,
        userEmail,
        childId,
        2,
      )) as any;

      expect(result.module_2.unlocked).toBe(true);
      expect(result.module_2.accessible).toBe(false);
    });

    it("returns module_2 as unlocked and accessible when baseDate set and prev module completed", async () => {
      const pastDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      childRepo.findOne.mockResolvedValue(mockChild);
      userPlanRepo.findOne.mockResolvedValue({
        id: "up-1",
        userId,
        isActive: true,
        purchasedAt: pastDate,
      });
      // prev module (1) completed
      childModuleRepo.findOne
        .mockResolvedValueOnce({ id: "cm-1", moduleNo: 1, isCompleted: true }) // prev module lookup
        .mockResolvedValueOnce(null); // current module lookup

      const result = (await service.getAccessStatus(
        userId,
        userEmail,
        childId,
        2,
      )) as any;

      expect(result.module_2.unlocked).toBe(true);
      expect(result.module_2.accessible).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // getAccessStatus — all modules (no moduleNo param)
  // -----------------------------------------------------------------------
  describe("getAccessStatus — all modules", () => {
    it("returns all 6 modules when no moduleNo is specified", async () => {
      childRepo.findOne.mockResolvedValue(mockChild);
      userPlanRepo.findOne.mockResolvedValue(null);
      childModuleRepo.find.mockResolvedValue([]);

      const result = (await service.getAccessStatus(
        userId,
        userEmail,
        childId,
      )) as any;

      expect(Object.keys(result)).toHaveLength(6);
      for (let i = 1; i <= 6; i++) {
        expect(result[`module_${i}`]).toBeDefined();
      }
    });

    it("module_1 is locked/inaccessible when there is no plan", async () => {
      childRepo.findOne.mockResolvedValue(mockChild);
      userPlanRepo.findOne.mockResolvedValue(null);
      childModuleRepo.find.mockResolvedValue([]);

      const result = (await service.getAccessStatus(
        userId,
        userEmail,
        childId,
      )) as any;

      expect(result.module_1.unlocked).toBe(false);
      expect(result.module_1.accessible).toBe(false);
    });

    it("all modules 1-6 are locked when there is no user plan", async () => {
      childRepo.findOne.mockResolvedValue(mockChild);
      userPlanRepo.findOne.mockResolvedValue(null);
      childModuleRepo.find.mockResolvedValue([]);

      const result = (await service.getAccessStatus(
        userId,
        userEmail,
        childId,
      )) as any;

      for (let i = 1; i <= 6; i++) {
        expect(result[`module_${i}`].unlocked).toBe(false);
        expect(result[`module_${i}`].accessible).toBe(false);
      }
    });
  });

  // -----------------------------------------------------------------------
  // getAccessStatus — quest level
  // -----------------------------------------------------------------------
  describe("getAccessStatus — quest level", () => {
    it("returns quest_1 as accessible when module is accessible", async () => {
      childRepo.findOne.mockResolvedValue(mockChild);
      userPlanRepo.findOne.mockResolvedValue({
        id: "up-1",
        userId,
        isActive: true,
        purchasedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      });
      const mockChildModule = { id: "cm-1", moduleNo: 1, isCompleted: false };
      childModuleRepo.findOne
        .mockResolvedValueOnce(mockChildModule) // current module
        .mockResolvedValueOnce(null); // for prev quest check — not used for quest 1

      childQuestRepo.findOne.mockResolvedValue(null);

      const result = (await service.getAccessStatus(
        userId,
        userEmail,
        childId,
        1,
        1,
      )) as any;

      expect(result.module_1.quest_1.unlocked).toBe(true);
      expect(result.module_1.quest_1.accessible).toBe(true);
    });

    it("returns quest_2 as inaccessible when quest_1 is not completed", async () => {
      childRepo.findOne.mockResolvedValue(mockChild);
      userPlanRepo.findOne.mockResolvedValue({
        id: "up-1",
        userId,
        isActive: true,
        purchasedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      });
      const mockChildModule = { id: "cm-1", moduleNo: 1, isCompleted: false };

      childModuleRepo.findOne.mockResolvedValueOnce(mockChildModule);

      // prev quest (1) not completed
      childQuestRepo.findOne
        .mockResolvedValueOnce({ id: "cq-1", questNo: 1, isCompleted: false }) // prev quest
        .mockResolvedValueOnce(null); // current quest

      const result = (await service.getAccessStatus(
        userId,
        userEmail,
        childId,
        1,
        2,
      )) as any;

      expect(result.module_1.quest_2.accessible).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // getAccessStatus — screen level
  // -----------------------------------------------------------------------
  describe("getAccessStatus — screen level", () => {
    it("returns screen status nested under module and quest", async () => {
      childRepo.findOne.mockResolvedValue(mockChild);
      userPlanRepo.findOne.mockResolvedValue({
        id: "up-1",
        userId,
        isActive: true,
        purchasedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      });
      const mockChildModule = { id: "cm-1", moduleNo: 1, isCompleted: false };
      const mockChildQuest = {
        id: "cq-1",
        questNo: 1,
        moduleId: "cm-1",
        isCompleted: false,
      };

      childModuleRepo.findOne.mockResolvedValueOnce(mockChildModule);
      childQuestRepo.findOne
        .mockResolvedValueOnce(null) // prev quest — n/a for quest 1
        .mockResolvedValueOnce(mockChildQuest); // current quest
      childScreenRepo.findOne.mockResolvedValue(null);

      const result = (await service.getAccessStatus(
        userId,
        userEmail,
        childId,
        1,
        1,
        1,
      )) as any;

      expect(result.module_1).toBeDefined();
      expect(result.module_1.quest_1).toBeDefined();
      expect(result.module_1.quest_1.screen_1).toBeDefined();
      expect(result.module_1.quest_1.screen_1.accessible).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // getAccessList — include=[] returns only module_list
  // -----------------------------------------------------------------------
  describe("getAccessList", () => {
    it("throws ForbiddenException when child is not found", async () => {
      childRepo.findOne.mockResolvedValue(null);

      await expect(
        service.getAccessList(userId, userEmail, childId, []),
      ).rejects.toThrow(ForbiddenException);
    });

    it("returns only module_list when include is empty", async () => {
      childRepo.findOne.mockResolvedValue(mockChild);
      userPlanRepo.findOne.mockResolvedValue(null);
      childModuleRepo.find.mockResolvedValue([]);

      const result = await service.getAccessList(
        userId,
        userEmail,
        childId,
        [],
      );

      expect(result).toHaveProperty("module_list");
      expect(result).not.toHaveProperty("quest_list");
      expect(result).not.toHaveProperty("screen_list");
      expect((result.module_list as any[]).length).toBe(6);
    });

    it("returns module_list with correct shape for each module", async () => {
      childRepo.findOne.mockResolvedValue(mockChild);
      userPlanRepo.findOne.mockResolvedValue(null);
      childModuleRepo.find.mockResolvedValue([]);

      const result = await service.getAccessList(
        userId,
        userEmail,
        childId,
        [],
      );
      const list = result.module_list as any[];

      expect(list[0]).toMatchObject({
        module: 1,
        status: "initialized",
        accessible: false,
        unlocked: false,
        isCompleted: false,
      });
    });

    it("returns module_1 as unlocked/accessible in module_list once a plan is purchased", async () => {
      childRepo.findOne.mockResolvedValue(mockChild);
      userPlanRepo.findOne.mockResolvedValue({
        id: "up-1",
        userId,
        isActive: true,
        purchasedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      });
      childModuleRepo.find.mockResolvedValue([]);

      const result = await service.getAccessList(
        userId,
        userEmail,
        childId,
        [],
      );
      const list = result.module_list as any[];

      expect(list[0]).toMatchObject({
        module: 1,
        accessible: true,
        unlocked: true,
      });
    });

    it("returns module_list + quest_list when include=['quest']", async () => {
      childRepo.findOne.mockResolvedValue(mockChild);
      userPlanRepo.findOne.mockResolvedValue(null);
      childModuleRepo.find.mockResolvedValue([]);
      childQuestRepo.find.mockResolvedValue([]);

      const result = await service.getAccessList(userId, userEmail, childId, [
        "quest",
      ]);

      expect(result).toHaveProperty("module_list");
      expect(result).toHaveProperty("quest_list");
      expect(result).not.toHaveProperty("screen_list");
    });

    it("returns quest_list entries for all quests in module 1", async () => {
      childRepo.findOne.mockResolvedValue(mockChild);
      userPlanRepo.findOne.mockResolvedValue(null);
      childModuleRepo.find.mockResolvedValue([]);
      childQuestRepo.find.mockResolvedValue([]);

      const result = await service.getAccessList(userId, userEmail, childId, [
        "quest",
      ]);
      const questList = result.quest_list as any[];

      // Module 1 has quests 1-7 per our mock
      const module1Quests = questList.filter((q: any) => q.module === 1);
      expect(module1Quests.length).toBe(7);
    });

    it("returns module_list + quest_list + screen_list when include=['quest','screen']", async () => {
      childRepo.findOne.mockResolvedValue(mockChild);
      userPlanRepo.findOne.mockResolvedValue(null);
      childModuleRepo.find.mockResolvedValue([]);
      childQuestRepo.find.mockResolvedValue([]);
      childScreenRepo.find.mockResolvedValue([]);

      const result = await service.getAccessList(userId, userEmail, childId, [
        "quest",
        "screen",
      ]);

      expect(result).toHaveProperty("module_list");
      expect(result).toHaveProperty("quest_list");
      expect(result).toHaveProperty("screen_list");
    });

    it("reflects completed status when childModule record exists and isCompleted=true", async () => {
      childRepo.findOne.mockResolvedValue(mockChild);
      userPlanRepo.findOne.mockResolvedValue(null);

      const completedAt = new Date("2026-01-01");
      childModuleRepo.find.mockResolvedValue([
        { id: "cm-1", moduleNo: 1, isCompleted: true, completedAt },
      ]);

      const result = await service.getAccessList(
        userId,
        userEmail,
        childId,
        [],
      );
      const list = result.module_list as any[];
      const module1 = list.find((m: any) => m.module === 1);

      expect(module1.isCompleted).toBe(true);
      expect(module1.status).toBe("completed");
      expect(module1.completedAt).toEqual(completedAt);
    });

    it("does not fetch quests when include is empty (no childQuestRepository calls)", async () => {
      childRepo.findOne.mockResolvedValue(mockChild);
      userPlanRepo.findOne.mockResolvedValue(null);
      childModuleRepo.find.mockResolvedValue([]);

      await service.getAccessList(userId, userEmail, childId, []);

      expect(childQuestRepo.find).not.toHaveBeenCalled();
      expect(childScreenRepo.find).not.toHaveBeenCalled();
    });
  });
});
