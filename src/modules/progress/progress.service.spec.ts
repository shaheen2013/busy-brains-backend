import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { DataSource } from "typeorm";
import { ProgressService } from "./progress.service";
import { Child } from "../children/entities/child.entity";
import { ChildModule } from "../children/entities/child-module.entity";
import { ChildQuest } from "../children/entities/child-quest.entity";
import { ChildScreen } from "../children/entities/child-screen.entity";
import { KitService } from "../kit/kit.service";

jest.mock("../../constants/module-registry", () => ({
  moduleRegistry: {
    perModule: {
      "1": {
        quests: {
          "1": { screens: 1 },
          "2": { screens: 1 },
          "3": { screens: 1 },
          "4": { screens: 3 },
          "5": { screens: 3 },
          "6": { screens: 1 },
          "7": { screens: 2 },
        },
      },
      "2": {
        quests: {
          "1": { screens: 2 },
          "2": { screens: 1 },
          "3": { screens: 1 },
          "4": { screens: 1 },
          "5": { screens: 1 },
          "6": { screens: 2 },
        },
      },
      "3": {
        quests: {
          "1": { screens: 2 },
          "2": { screens: 1 },
          "3": { screens: 2 },
          "4": { screens: 2 },
          "5": { screens: 2 },
        },
      },
      "4": {
        quests: {
          "1": { screens: 2 },
          "2": { screens: 3 },
          "3": { screens: 2 },
          "4": { screens: 3 },
          "5": { screens: 3 },
          "6": { screens: 2 },
        },
      },
      "5": {
        quests: {
          "1": { screens: 2 },
          "2": { screens: 3 },
          "3": { screens: 4 },
          "4": { screens: 0 },
          "5": { screens: 0 },
          "6": { screens: 0 },
        },
      },
      "6": {
        quests: {
          "1": { screens: 0 },
          "2": { screens: 0 },
          "3": { screens: 0 },
          "4": { screens: 0 },
          "5": { screens: 0 },
          "6": { screens: 0 },
        },
      },
    },
  },
}));

describe("ProgressService", () => {
  let service: ProgressService;

  let mockQueryRunnerManager: {
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    countBy: jest.Mock;
  };

  let mockQueryRunner: {
    connect: jest.Mock;
    startTransaction: jest.Mock;
    commitTransaction: jest.Mock;
    rollbackTransaction: jest.Mock;
    release: jest.Mock;
    manager: typeof mockQueryRunnerManager;
  };

  let mockChildRepository: { findOneBy: jest.Mock };
  let mockDataSource: {
    createQueryRunner: jest.Mock;
    getRepository: jest.Mock;
  };

  let mockKitService: { notifyModule1Completed: jest.Mock };

  const userId = "user-uuid-1";
  const childId = "child-uuid-1";
  const mockChild = { id: childId, userId, name: "Test Child" };

  const makeChildModule = (
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

  const makeChildQuest = (
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

  const makeChildScreen = (
    screenNo: number,
    questId: string,
    isCompleted = false,
    id = `cs-${screenNo}`,
  ) =>
    ({
      id,
      questId,
      screenNo,
      isCompleted,
      completedAt: isCompleted ? new Date() : null,
      data: null,
    }) as ChildScreen;

  beforeEach(async () => {
    mockQueryRunnerManager = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      create: jest
        .fn()
        .mockImplementation((_Entity: any, data: any) => ({ ...data })),
      countBy: jest.fn(),
    };

    mockQueryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: mockQueryRunnerManager,
    };

    const getRepositoryMock = jest.fn().mockReturnValue({
      findOneBy: jest.fn(),
    });

    mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
      getRepository: getRepositoryMock,
    };

    mockChildRepository = { findOneBy: jest.fn() };
    mockKitService = {
      notifyModule1Completed: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProgressService,
        {
          provide: getRepositoryToken(Child),
          useValue: mockChildRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: KitService,
          useValue: mockKitService,
        },
      ],
    }).compile();

    service = module.get<ProgressService>(ProgressService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // saveScreen — validation
  // -----------------------------------------------------------------------
  describe("saveScreen — validation", () => {
    it("throws ForbiddenException when child is not found", async () => {
      mockChildRepository.findOneBy.mockResolvedValue(null);

      await expect(
        service.saveScreen(userId, childId, 1, 1, 1, {}),
      ).rejects.toThrow(ForbiddenException);
    });

    it("throws BadRequestException for invalid module number", async () => {
      mockChildRepository.findOneBy.mockResolvedValue(mockChild);

      await expect(
        service.saveScreen(userId, childId, 99, 1, 1, {}),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws BadRequestException for invalid quest number", async () => {
      mockChildRepository.findOneBy.mockResolvedValue(mockChild);

      await expect(
        service.saveScreen(userId, childId, 1, 99, 1, {}),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws BadRequestException for invalid screen number (too high)", async () => {
      mockChildRepository.findOneBy.mockResolvedValue(mockChild);

      // module 1, quest 1 has only 1 screen — screen 2 is invalid
      await expect(
        service.saveScreen(userId, childId, 1, 1, 2, {}),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws BadRequestException for screen number less than 1", async () => {
      mockChildRepository.findOneBy.mockResolvedValue(mockChild);

      await expect(
        service.saveScreen(userId, childId, 1, 1, 0, {}),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws BadRequestException when previous module is not completed (moduleNo > 1)", async () => {
      mockChildRepository.findOneBy.mockResolvedValue(mockChild);

      // prev module (1) not completed
      mockQueryRunnerManager.findOne.mockResolvedValueOnce(
        makeChildModule(1, false), // prevModule — not completed
      );

      await expect(
        service.saveScreen(userId, childId, 2, 1, 1, {}),
      ).rejects.toThrow(BadRequestException);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it("throws BadRequestException when previous module does not exist (moduleNo > 1)", async () => {
      mockChildRepository.findOneBy.mockResolvedValue(mockChild);

      // prev module not found at all
      mockQueryRunnerManager.findOne.mockResolvedValueOnce(null);

      await expect(
        service.saveScreen(userId, childId, 2, 1, 1, {}),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws BadRequestException when previous quest is not completed (questNo > 1)", async () => {
      mockChildRepository.findOneBy.mockResolvedValue(mockChild);

      const childModule = makeChildModule(1, false);

      mockQueryRunnerManager.findOne
        .mockResolvedValueOnce(childModule) // find existing ChildModule
        .mockResolvedValueOnce(makeChildQuest(1, childModule.id, false)); // prev quest not completed

      await expect(
        service.saveScreen(userId, childId, 1, 2, 1, {}),
      ).rejects.toThrow(BadRequestException);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it("throws BadRequestException when previous screen is not completed (screenNo > 1)", async () => {
      mockChildRepository.findOneBy.mockResolvedValue(mockChild);

      // module 1, quest 4 has 3 screens — so screenNo=2 or 3 is valid but requires prev complete
      const childModule = makeChildModule(1, false);
      const childQuest = makeChildQuest(1, childModule.id, false);

      mockQueryRunnerManager.findOne
        .mockResolvedValueOnce(childModule) // find existing ChildModule
        .mockResolvedValueOnce(childQuest) // find existing ChildQuest
        .mockResolvedValueOnce(makeChildScreen(1, childQuest.id, false)); // prev screen not completed

      await expect(
        service.saveScreen(userId, childId, 1, 4, 2, {}),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // -----------------------------------------------------------------------
  // saveScreen — happy paths
  // -----------------------------------------------------------------------
  describe("saveScreen — happy path", () => {
    it("creates a new screen record when it does not exist", async () => {
      mockChildRepository.findOneBy.mockResolvedValue(mockChild);

      const childModule = makeChildModule(1, false);
      const childQuest = makeChildQuest(1, childModule.id, false);
      const dto = { isCompleted: false, data: { answer: "A" } };
      const newScreen = makeChildScreen(1, childQuest.id, false);

      mockQueryRunnerManager.findOne
        .mockResolvedValueOnce(childModule) // find existing module
        .mockResolvedValueOnce(childQuest) // find existing quest
        .mockResolvedValueOnce(null); // screen does not exist yet

      mockQueryRunnerManager.create.mockReturnValue(newScreen);
      mockQueryRunnerManager.save.mockResolvedValue(newScreen);
      mockQueryRunnerManager.countBy.mockResolvedValue(0);

      const result = await service.saveScreen(userId, childId, 1, 1, 1, dto);

      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.rollbackTransaction).not.toHaveBeenCalled();
      expect(result).toEqual(newScreen);
    });

    it("updates existing screen record when it already exists", async () => {
      mockChildRepository.findOneBy.mockResolvedValue(mockChild);

      const childModule = makeChildModule(1, false);
      const childQuest = makeChildQuest(1, childModule.id, false);
      const existingScreen = makeChildScreen(1, childQuest.id, false);
      existingScreen.data = { old: "value" };

      const dto = { isCompleted: true, data: { new: "value" } };

      mockQueryRunnerManager.findOne
        .mockResolvedValueOnce(childModule) // find existing module
        .mockResolvedValueOnce(childQuest) // find existing quest
        .mockResolvedValueOnce(existingScreen); // find existing screen

      mockQueryRunnerManager.save.mockResolvedValue({
        ...existingScreen,
        isCompleted: true,
      });
      mockQueryRunnerManager.countBy.mockResolvedValue(1); // 1 screen completed → meets threshold

      const result = await service.saveScreen(userId, childId, 1, 1, 1, dto);

      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(result.isCompleted).toBe(true);
    });

    it("creates ChildModule when it does not exist", async () => {
      mockChildRepository.findOneBy.mockResolvedValue(mockChild);

      const newModule = makeChildModule(1, false);
      const childQuest = makeChildQuest(1, newModule.id, false);
      const newScreen = makeChildScreen(1, childQuest.id, false);

      mockQueryRunnerManager.findOne
        .mockResolvedValueOnce(null) // module not found
        .mockResolvedValueOnce(childQuest) // find existing quest
        .mockResolvedValueOnce(null); // screen not found

      mockQueryRunnerManager.create
        .mockReturnValueOnce(newModule) // create module
        .mockReturnValueOnce(newScreen); // create screen

      mockQueryRunnerManager.save
        .mockResolvedValueOnce(newModule) // save module
        .mockResolvedValueOnce(newScreen); // save screen

      mockQueryRunnerManager.countBy.mockResolvedValue(0);

      await service.saveScreen(userId, childId, 1, 1, 1, {});

      expect(mockQueryRunnerManager.create).toHaveBeenCalledWith(
        ChildModule,
        expect.objectContaining({ childId, moduleNo: 1 }),
      );
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it("creates ChildQuest when it does not exist", async () => {
      mockChildRepository.findOneBy.mockResolvedValue(mockChild);

      const childModule = makeChildModule(1, false);
      const newQuest = makeChildQuest(1, childModule.id, false);
      const newScreen = makeChildScreen(1, newQuest.id, false);

      mockQueryRunnerManager.findOne
        .mockResolvedValueOnce(childModule) // find existing module
        .mockResolvedValueOnce(null) // quest not found
        .mockResolvedValueOnce(null); // screen not found

      mockQueryRunnerManager.create
        .mockReturnValueOnce(newQuest) // create quest
        .mockReturnValueOnce(newScreen); // create screen

      mockQueryRunnerManager.save
        .mockResolvedValueOnce(newQuest) // save quest
        .mockResolvedValueOnce(newScreen); // save screen

      mockQueryRunnerManager.countBy.mockResolvedValue(0);

      await service.saveScreen(userId, childId, 1, 1, 1, {});

      expect(mockQueryRunnerManager.create).toHaveBeenCalledWith(
        ChildQuest,
        expect.objectContaining({ moduleId: childModule.id, questNo: 1 }),
      );
    });

    it("always releases the queryRunner even on success", async () => {
      mockChildRepository.findOneBy.mockResolvedValue(mockChild);

      const childModule = makeChildModule(1, false);
      const childQuest = makeChildQuest(1, childModule.id, false);
      const screen = makeChildScreen(1, childQuest.id, false);

      mockQueryRunnerManager.findOne
        .mockResolvedValueOnce(childModule)
        .mockResolvedValueOnce(childQuest)
        .mockResolvedValueOnce(null);

      mockQueryRunnerManager.create.mockReturnValue(screen);
      mockQueryRunnerManager.save.mockResolvedValue(screen);
      mockQueryRunnerManager.countBy.mockResolvedValue(0);

      await service.saveScreen(userId, childId, 1, 1, 1, {});

      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // saveScreen — cascade: quest/module completion
  // -----------------------------------------------------------------------
  describe("saveScreen — cascade completion", () => {
    it("marks quest as completed when all screens are done and triggers module completion check", async () => {
      mockChildRepository.findOneBy.mockResolvedValue(mockChild);

      // module 1, quest 1 has 1 screen
      const childModule = makeChildModule(1, false);
      const childQuest = makeChildQuest(1, childModule.id, false);
      const existingScreen = makeChildScreen(1, childQuest.id, false);

      mockQueryRunnerManager.findOne
        .mockResolvedValueOnce(childModule)
        .mockResolvedValueOnce(childQuest)
        .mockResolvedValueOnce(existingScreen);

      mockQueryRunnerManager.save.mockResolvedValue({
        ...existingScreen,
        isCompleted: true,
      });

      // 1 screen completed >= 1 total → quest completes
      mockQueryRunnerManager.countBy
        .mockResolvedValueOnce(1) // completedScreenCount >= questData.screens
        .mockResolvedValueOnce(7); // completedQuestCount >= totalQuests (module 1 has 7 quests)

      await service.saveScreen(userId, childId, 1, 1, 1, { isCompleted: true });

      // quest should be saved with isCompleted = true
      const saveCalls = mockQueryRunnerManager.save.mock.calls;
      const questSave = saveCalls.find(
        (call: any[]) =>
          call[0]?.questNo === 1 && call[0]?.moduleId !== undefined,
      );
      expect(questSave).toBeDefined();
    });

    it("calls kitService.notifyModule1Completed when module 1 is fully completed", async () => {
      mockChildRepository.findOneBy.mockResolvedValue(mockChild);

      const childModule = makeChildModule(1, false);
      const childQuest = makeChildQuest(1, childModule.id, false);
      const existingScreen = makeChildScreen(1, childQuest.id, false);

      mockQueryRunnerManager.findOne
        .mockResolvedValueOnce(childModule)
        .mockResolvedValueOnce(childQuest)
        .mockResolvedValueOnce(existingScreen);

      mockQueryRunnerManager.save.mockResolvedValue({
        ...existingScreen,
        isCompleted: true,
      });

      mockQueryRunnerManager.countBy
        .mockResolvedValueOnce(1) // completedScreenCount
        .mockResolvedValueOnce(7); // completedQuestCount >= 7 (all quests)

      await service.saveScreen(userId, childId, 1, 1, 1, { isCompleted: true });

      expect(mockKitService.notifyModule1Completed).toHaveBeenCalledWith(
        userId,
        mockChild.name,
      );
    });

    it("does NOT call kitService.notifyModule1Completed when moduleNo is not 1", async () => {
      mockChildRepository.findOneBy.mockResolvedValue(mockChild);

      // For module 2, need prev module completed
      const prevModule = makeChildModule(1, true);
      const childModule = makeChildModule(2, false);
      const childQuest = makeChildQuest(1, childModule.id, false);
      const existingScreen = makeChildScreen(1, childQuest.id, false);

      mockQueryRunnerManager.findOne
        .mockResolvedValueOnce(prevModule) // prevModule check
        .mockResolvedValueOnce(childModule) // find existing ChildModule
        .mockResolvedValueOnce(childQuest) // find existing ChildQuest
        .mockResolvedValueOnce(existingScreen);

      mockQueryRunnerManager.save.mockResolvedValue({
        ...existingScreen,
        isCompleted: true,
      });

      // module 2 quest 1 has 2 screens; only 1 completed → quest not completed
      mockQueryRunnerManager.countBy.mockResolvedValue(1);

      await service.saveScreen(userId, childId, 2, 1, 1, { isCompleted: true });

      expect(mockKitService.notifyModule1Completed).not.toHaveBeenCalled();
    });

    it("rolls back transaction on error and rethrows", async () => {
      mockChildRepository.findOneBy.mockResolvedValue(mockChild);

      const childModule = makeChildModule(1, false);
      const childQuest = makeChildQuest(1, childModule.id, false);

      mockQueryRunnerManager.findOne
        .mockResolvedValueOnce(childModule)
        .mockResolvedValueOnce(childQuest)
        .mockResolvedValueOnce(null);

      const errorScreen = makeChildScreen(1, childQuest.id, false);
      mockQueryRunnerManager.create.mockReturnValue(errorScreen);
      mockQueryRunnerManager.save.mockRejectedValue(new Error("DB error"));

      await expect(
        service.saveScreen(userId, childId, 1, 1, 1, {}),
      ).rejects.toThrow("DB error");

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // getScreen
  // -----------------------------------------------------------------------
  describe("getScreen", () => {
    it("throws ForbiddenException when child is not found", async () => {
      mockChildRepository.findOneBy.mockResolvedValue(null);

      await expect(service.getScreen(userId, childId, 1, 1, 1)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("returns empty object when ChildModule is not found", async () => {
      mockChildRepository.findOneBy.mockResolvedValue(mockChild);

      // getRepository returns a repo where findOneBy returns null
      const mockChildModuleRepo = {
        findOneBy: jest.fn().mockResolvedValue(null),
      };
      mockDataSource.getRepository.mockReturnValue(mockChildModuleRepo);

      const result = await service.getScreen(userId, childId, 1, 1, 1);

      expect(result).toEqual({});
    });

    it("returns empty object when ChildQuest is not found", async () => {
      mockChildRepository.findOneBy.mockResolvedValue(mockChild);

      const childModule = makeChildModule(1, false);
      const mockChildModuleRepo = {
        findOneBy: jest.fn().mockResolvedValue(childModule),
      };
      const mockChildQuestRepo = {
        findOneBy: jest.fn().mockResolvedValue(null),
      };

      mockDataSource.getRepository
        .mockReturnValueOnce(mockChildModuleRepo)
        .mockReturnValueOnce(mockChildQuestRepo);

      const result = await service.getScreen(userId, childId, 1, 1, 1);

      expect(result).toEqual({});
    });

    it("returns empty object when ChildScreen is not found", async () => {
      mockChildRepository.findOneBy.mockResolvedValue(mockChild);

      const childModule = makeChildModule(1, false);
      const childQuest = makeChildQuest(1, childModule.id, false);
      const mockChildModuleRepo = {
        findOneBy: jest.fn().mockResolvedValue(childModule),
      };
      const mockChildQuestRepo = {
        findOneBy: jest.fn().mockResolvedValue(childQuest),
      };
      const mockChildScreenRepo = {
        findOneBy: jest.fn().mockResolvedValue(null),
      };

      mockDataSource.getRepository
        .mockReturnValueOnce(mockChildModuleRepo)
        .mockReturnValueOnce(mockChildQuestRepo)
        .mockReturnValueOnce(mockChildScreenRepo);

      const result = await service.getScreen(userId, childId, 1, 1, 1);

      expect(result).toEqual({});
    });

    it("returns the screen when all records are found", async () => {
      mockChildRepository.findOneBy.mockResolvedValue(mockChild);

      const childModule = makeChildModule(1, false);
      const childQuest = makeChildQuest(1, childModule.id, false);
      const existingScreen = makeChildScreen(1, childQuest.id, true);

      const mockChildModuleRepo = {
        findOneBy: jest.fn().mockResolvedValue(childModule),
      };
      const mockChildQuestRepo = {
        findOneBy: jest.fn().mockResolvedValue(childQuest),
      };
      const mockChildScreenRepo = {
        findOneBy: jest.fn().mockResolvedValue(existingScreen),
      };

      mockDataSource.getRepository
        .mockReturnValueOnce(mockChildModuleRepo)
        .mockReturnValueOnce(mockChildQuestRepo)
        .mockReturnValueOnce(mockChildScreenRepo);

      const result = await service.getScreen(userId, childId, 1, 1, 1);

      expect(result).toEqual(existingScreen);
      expect(result.isCompleted).toBe(true);
    });

    it("queries ChildModule with correct childId and moduleNo", async () => {
      mockChildRepository.findOneBy.mockResolvedValue(mockChild);

      const mockChildModuleRepo = {
        findOneBy: jest.fn().mockResolvedValue(null),
      };
      mockDataSource.getRepository.mockReturnValue(mockChildModuleRepo);

      await service.getScreen(userId, childId, 2, 3, 1);

      expect(mockChildModuleRepo.findOneBy).toHaveBeenCalledWith({
        childId,
        moduleNo: 2,
      });
    });
  });
});
