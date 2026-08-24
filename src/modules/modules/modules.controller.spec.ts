import { Test, TestingModule } from "@nestjs/testing";
import { ModulesController } from "./modules.controller";
import { ModulesService } from "./modules.service";

const mockModulesService = {
  getAccessList: jest.fn(),
  getAccessStatus: jest.fn(),
};

describe("ModulesController", () => {
  let controller: ModulesController;
  let service: ModulesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ModulesController],
      providers: [
        {
          provide: ModulesService,
          useValue: mockModulesService,
        },
      ],
    }).compile();

    controller = module.get<ModulesController>(ModulesController);
    service = module.get<ModulesService>(ModulesService);

    jest.clearAllMocks();
  });

  describe("getAccessList", () => {
    it("should call modulesService.getAccessList with user id, childId, and include array", async () => {
      const user = { id: "user-uuid-1", email: "user1@example.com" };
      const query = { childId: "child-uuid-1", include: ["quest", "screen"] };
      const expectedResult = {
        module_list: [],
        quest_list: [],
        screen_list: [],
      };

      mockModulesService.getAccessList.mockResolvedValue(expectedResult);

      const result = await controller.getAccessList(
        user as any,
        query.childId,
        query.include,
      );

      expect(service.getAccessList).toHaveBeenCalledTimes(1);
      expect(service.getAccessList).toHaveBeenCalledWith(
        "user-uuid-1",
        "user1@example.com",
        "child-uuid-1",
        ["quest", "screen"],
      );
      expect(result).toEqual(expectedResult);
    });

    it("should pass empty array as include when not provided", async () => {
      const user = { id: "user-uuid-1", email: "user1@example.com" };
      const childId = "child-uuid-1";
      const include: string[] = [];
      const expectedResult = { module_list: [] };

      mockModulesService.getAccessList.mockResolvedValue(expectedResult);

      const result = await controller.getAccessList(
        user as any,
        childId,
        include,
      );

      expect(service.getAccessList).toHaveBeenCalledWith(
        "user-uuid-1",
        "user1@example.com",
        "child-uuid-1",
        [],
      );
      expect(result).toEqual(expectedResult);
    });

    it("should return whatever the service returns", async () => {
      const user = { id: "user-uuid-2", email: "user2@example.com" };
      const childId = "child-uuid-2";
      const include = ["quest"];
      const serviceReturn = {
        module_list: [{ module: 1 }],
        quest_list: [{ module: 1, quest: 1 }],
      };

      mockModulesService.getAccessList.mockResolvedValue(serviceReturn);

      const result = await controller.getAccessList(
        user as any,
        childId,
        include,
      );

      expect(result).toBe(serviceReturn);
    });
  });

  describe("getAccessStatus", () => {
    it("should call modulesService.getAccessStatus with user id and query params", async () => {
      const user = { id: "user-uuid-1", email: "user1@example.com" };
      const query = {
        childId: "child-uuid-1",
        module: 1,
        quest: undefined,
        screen: undefined,
      };
      const expectedResult = { module_1: { unlocked: true, accessible: true } };

      mockModulesService.getAccessStatus.mockResolvedValue(expectedResult);

      const result = await controller.getAccessStatus(user as any, query);

      expect(service.getAccessStatus).toHaveBeenCalledTimes(1);
      expect(service.getAccessStatus).toHaveBeenCalledWith(
        "user-uuid-1",
        "user1@example.com",
        "child-uuid-1",
        1,
        undefined,
        undefined,
      );
      expect(result).toEqual(expectedResult);
    });

    it("should call service with module, quest, and screen when all are provided", async () => {
      const user = { id: "user-uuid-1", email: "user1@example.com" };
      const query = {
        childId: "child-uuid-1",
        module: 1,
        quest: 2,
        screen: 3,
      };

      mockModulesService.getAccessStatus.mockResolvedValue({});

      await controller.getAccessStatus(user as any, query);

      expect(service.getAccessStatus).toHaveBeenCalledWith(
        "user-uuid-1",
        "user1@example.com",
        "child-uuid-1",
        1,
        2,
        3,
      );
    });

    it("should call service with undefined module, quest, screen when only childId is provided", async () => {
      const user = { id: "user-uuid-1", email: "user1@example.com" };
      const query = {
        childId: "child-uuid-1",
        module: undefined,
        quest: undefined,
        screen: undefined,
      };

      mockModulesService.getAccessStatus.mockResolvedValue({});

      await controller.getAccessStatus(user as any, query);

      expect(service.getAccessStatus).toHaveBeenCalledWith(
        "user-uuid-1",
        "user1@example.com",
        "child-uuid-1",
        undefined,
        undefined,
        undefined,
      );
    });

    it("should propagate service errors", async () => {
      const user = { id: "user-uuid-1", email: "user1@example.com" };
      const query = {
        childId: "bad-child",
        module: undefined,
        quest: undefined,
        screen: undefined,
      };

      mockModulesService.getAccessStatus.mockRejectedValue(
        new Error("Child not found"),
      );

      await expect(
        controller.getAccessStatus(user as any, query),
      ).rejects.toThrow("Child not found");
    });
  });
});
