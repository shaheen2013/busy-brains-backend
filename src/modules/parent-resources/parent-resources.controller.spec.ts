import { Test, TestingModule } from "@nestjs/testing";
import { ParentResourcesController } from "./parent-resources.controller";
import { ParentResourcesService } from "./parent-resources.service";
import { User } from "../users/entities/user.entity";
import { PARENT_RESOURCES } from "../../common/parent-resources.constants";

const mockParentResourcesService = {
  getResources: jest.fn(),
};

const mockUser: Partial<User> = {
  id: "user-uuid-123",
  email: "test@example.com",
  name: "Test User",
};

describe("ParentResourcesController", () => {
  let controller: ParentResourcesController;
  let service: typeof mockParentResourcesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ParentResourcesController],
      providers: [
        {
          provide: ParentResourcesService,
          useValue: mockParentResourcesService,
        },
      ],
    }).compile();

    controller = module.get<ParentResourcesController>(
      ParentResourcesController,
    );
    service = module.get(ParentResourcesService);

    jest.clearAllMocks();
  });

  describe("getResources()", () => {
    it("should call parentResourcesService.getResources with the user id", async () => {
      service.getResources.mockResolvedValue(PARENT_RESOURCES);

      await controller.getResources(mockUser as User);

      expect(service.getResources).toHaveBeenCalledTimes(1);
      expect(service.getResources).toHaveBeenCalledWith(mockUser.id);
    });

    it("should return the result from parentResourcesService.getResources", async () => {
      service.getResources.mockResolvedValue(PARENT_RESOURCES);

      const result = await controller.getResources(mockUser as User);

      expect(result).toBe(PARENT_RESOURCES);
    });

    it("should return an empty array when service returns empty", async () => {
      service.getResources.mockResolvedValue([]);

      const result = await controller.getResources(mockUser as User);

      expect(result).toEqual([]);
    });

    it("should propagate errors thrown by the service", async () => {
      service.getResources.mockRejectedValue(new Error("DB error"));

      await expect(controller.getResources(mockUser as User)).rejects.toThrow(
        "DB error",
      );
    });
  });
});
