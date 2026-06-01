import { Test, TestingModule } from "@nestjs/testing";
import { ProgressController } from "./progress.controller";
import { ProgressService } from "./progress.service";

const mockProgressService = {
  saveScreen: jest.fn(),
  getScreen: jest.fn(),
};

describe("ProgressController", () => {
  let controller: ProgressController;
  let service: ProgressService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProgressController],
      providers: [
        {
          provide: ProgressService,
          useValue: mockProgressService,
        },
      ],
    }).compile();

    controller = module.get<ProgressController>(ProgressController);
    service = module.get<ProgressService>(ProgressService);

    jest.clearAllMocks();
  });

  describe("saveScreen", () => {
    it("should call progressService.saveScreen with correct arguments", async () => {
      const user = { id: "user-uuid-1" };
      const childId = "child-uuid-1";
      const moduleNo = 1;
      const questNo = 2;
      const screenNo = 3;
      const dto = { isCompleted: true, data: { answer: "A" } };
      const savedScreen = {
        id: "screen-uuid-1",
        screenNo: 3,
        isCompleted: true,
      };

      mockProgressService.saveScreen.mockResolvedValue(savedScreen);

      const result = await controller.saveScreen(
        user as any,
        childId,
        moduleNo,
        questNo,
        screenNo,
        dto,
      );

      expect(service.saveScreen).toHaveBeenCalledTimes(1);
      expect(service.saveScreen).toHaveBeenCalledWith(
        "user-uuid-1",
        "child-uuid-1",
        1,
        2,
        3,
        dto,
      );
      expect(result).toEqual(savedScreen);
    });

    it("should call saveScreen with empty dto when no body is given", async () => {
      const user = { id: "user-uuid-1" };
      const dto = {};

      mockProgressService.saveScreen.mockResolvedValue({});

      await controller.saveScreen(user as any, "child-uuid-1", 1, 1, 1, dto);

      expect(service.saveScreen).toHaveBeenCalledWith(
        "user-uuid-1",
        "child-uuid-1",
        1,
        1,
        1,
        dto,
      );
    });

    it("should propagate errors from the service", async () => {
      const user = { id: "user-uuid-1" };
      const dto = {};

      mockProgressService.saveScreen.mockRejectedValue(
        new Error("ForbiddenException"),
      );

      await expect(
        controller.saveScreen(user as any, "child-uuid-1", 1, 1, 1, dto),
      ).rejects.toThrow("ForbiddenException");
    });
  });

  describe("getScreen", () => {
    it("should call progressService.getScreen with correct arguments", async () => {
      const user = { id: "user-uuid-1" };
      const childId = "child-uuid-1";
      const moduleNo = 1;
      const questNo = 1;
      const screenNo = 2;
      const screen = { id: "screen-uuid-1", screenNo: 2 };

      mockProgressService.getScreen.mockResolvedValue(screen);

      const result = await controller.getScreen(
        user as any,
        childId,
        moduleNo,
        questNo,
        screenNo,
      );

      expect(service.getScreen).toHaveBeenCalledTimes(1);
      expect(service.getScreen).toHaveBeenCalledWith(
        "user-uuid-1",
        "child-uuid-1",
        1,
        1,
        2,
      );
      expect(result).toEqual(screen);
    });

    it("should return empty object when screen is not found", async () => {
      const user = { id: "user-uuid-1" };

      mockProgressService.getScreen.mockResolvedValue({});

      const result = await controller.getScreen(
        user as any,
        "child-uuid-1",
        1,
        1,
        1,
      );

      expect(result).toEqual({});
    });

    it("should propagate errors from the service", async () => {
      const user = { id: "user-uuid-1" };

      mockProgressService.getScreen.mockRejectedValue(
        new Error("Child not found"),
      );

      await expect(
        controller.getScreen(user as any, "child-uuid-1", 1, 1, 1),
      ).rejects.toThrow("Child not found");
    });
  });
});
