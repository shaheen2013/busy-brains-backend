import { Test, TestingModule } from "@nestjs/testing";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";

const mockDashboardService = {
  getDashboard: jest.fn(),
};

describe("DashboardController", () => {
  let controller: DashboardController;
  let service: DashboardService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        {
          provide: DashboardService,
          useValue: mockDashboardService,
        },
      ],
    }).compile();

    controller = module.get<DashboardController>(DashboardController);
    service = module.get<DashboardService>(DashboardService);

    jest.clearAllMocks();
  });

  describe("getDashboard", () => {
    it("should call dashboardService.getDashboard with user id, childId, and empty include array", async () => {
      const user = { id: "user-uuid-1" };
      const childId = "child-uuid-1";
      const include: string[] = [];
      const expectedResult = {
        module_progress: [],
        brain_data: {},
        tactile_data: {},
      };

      mockDashboardService.getDashboard.mockResolvedValue(expectedResult);

      const result = await controller.getDashboard(
        user as any,
        childId,
        include,
      );

      expect(service.getDashboard).toHaveBeenCalledTimes(1);
      expect(service.getDashboard).toHaveBeenCalledWith(
        "user-uuid-1",
        "child-uuid-1",
        [],
      );
      expect(result).toEqual(expectedResult);
    });

    it("should pass include=['quest'] when quest include is requested", async () => {
      const user = { id: "user-uuid-1" };
      const childId = "child-uuid-1";
      const include = ["quest"];

      mockDashboardService.getDashboard.mockResolvedValue({});

      await controller.getDashboard(user as any, childId, include);

      expect(service.getDashboard).toHaveBeenCalledWith(
        "user-uuid-1",
        "child-uuid-1",
        ["quest"],
      );
    });

    it("should pass include=['quest','screen'] when both are requested", async () => {
      const user = { id: "user-uuid-1" };
      const childId = "child-uuid-1";
      const include = ["quest", "screen"];

      mockDashboardService.getDashboard.mockResolvedValue({});

      await controller.getDashboard(user as any, childId, include);

      expect(service.getDashboard).toHaveBeenCalledWith(
        "user-uuid-1",
        "child-uuid-1",
        ["quest", "screen"],
      );
    });

    it("should return the result from the service", async () => {
      const user = { id: "user-uuid-2" };
      const childId = "child-uuid-2";
      const serviceResult = {
        brain_data: { status: "pending" },
        tactile_data: { status: "pending" },
        milestone: { halfway_explored: false },
        progress: { modules: { completed: 0, total: 6 } },
        module_progress: [],
      };

      mockDashboardService.getDashboard.mockResolvedValue(serviceResult);

      const result = await controller.getDashboard(user as any, childId, []);

      expect(result).toBe(serviceResult);
    });

    it("should propagate service errors", async () => {
      const user = { id: "user-uuid-1" };

      mockDashboardService.getDashboard.mockRejectedValue(
        new Error("Child not found"),
      );

      await expect(
        controller.getDashboard(user as any, "bad-child-id", []),
      ).rejects.toThrow("Child not found");
    });
  });
});
