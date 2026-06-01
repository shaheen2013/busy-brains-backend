import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ParentResourcesService } from "./parent-resources.service";
import { UserPlan } from "../subscriptions/entities/user-plan.entity";
import { Plan, PlanName } from "../subscriptions/entities/plan.entity";
import { PARENT_RESOURCES } from "../../common/parent-resources.constants";

const createMockRepository = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn(),
  create: jest.fn().mockImplementation((data) => data),
  update: jest.fn(),
  delete: jest.fn(),
});

describe("ParentResourcesService", () => {
  let service: ParentResourcesService;
  let userPlanRepository: ReturnType<typeof createMockRepository>;

  const userId = "user-uuid-123";

  beforeEach(async () => {
    userPlanRepository = createMockRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ParentResourcesService,
        {
          provide: getRepositoryToken(UserPlan),
          useValue: userPlanRepository,
        },
      ],
    }).compile();

    service = module.get<ParentResourcesService>(ParentResourcesService);
    jest.clearAllMocks();
  });

  describe("getResources()", () => {
    it("should return empty array when user has no active plan", async () => {
      userPlanRepository.findOne.mockResolvedValue(null);

      const result = await service.getResources(userId);

      expect(result).toEqual([]);
      expect(userPlanRepository.findOne).toHaveBeenCalledWith({
        where: { userId, isActive: true },
        relations: ["plan"],
      });
    });

    it("should return empty array when userPlan.plan is null", async () => {
      userPlanRepository.findOne.mockResolvedValue({
        userId,
        isActive: true,
        plan: null,
      });

      const result = await service.getResources(userId);

      expect(result).toEqual([]);
    });

    it("should return PARENT_RESOURCES when user has SOLO_EXPLORER plan", async () => {
      const mockPlan: Partial<Plan> = { name: PlanName.SOLO_EXPLORER };
      userPlanRepository.findOne.mockResolvedValue({
        userId,
        isActive: true,
        plan: mockPlan,
      });

      const result = await service.getResources(userId);

      expect(result).toBe(PARENT_RESOURCES);
      expect(result.length).toBeGreaterThan(0);
    });

    it("should return PARENT_RESOURCES when user has FAMILY_PACK plan", async () => {
      const mockPlan: Partial<Plan> = { name: PlanName.FAMILY_PACK };
      userPlanRepository.findOne.mockResolvedValue({
        userId,
        isActive: true,
        plan: mockPlan,
      });

      const result = await service.getResources(userId);

      expect(result).toBe(PARENT_RESOURCES);
    });

    it("should return empty array for an unknown plan name", async () => {
      const mockPlan = { name: "UNKNOWN_PLAN" };
      userPlanRepository.findOne.mockResolvedValue({
        userId,
        isActive: true,
        plan: mockPlan,
      });

      const result = await service.getResources(userId);

      expect(result).toEqual([]);
    });

    it("should query with the correct userId and isActive: true", async () => {
      userPlanRepository.findOne.mockResolvedValue(null);

      await service.getResources(userId);

      expect(userPlanRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId, isActive: true }),
        }),
      );
    });

    it("should eager-load the plan relation", async () => {
      userPlanRepository.findOne.mockResolvedValue(null);

      await service.getResources(userId);

      expect(userPlanRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ relations: ["plan"] }),
      );
    });

    it("should return resources with the expected shape", async () => {
      const mockPlan: Partial<Plan> = { name: PlanName.SOLO_EXPLORER };
      userPlanRepository.findOne.mockResolvedValue({
        userId,
        isActive: true,
        plan: mockPlan,
      });

      const result = await service.getResources(userId);

      expect(result.length).toBeGreaterThan(0);
      result.forEach((resource) => {
        expect(resource).toHaveProperty("title");
        expect(resource).toHaveProperty("module");
        expect(resource).toHaveProperty("download_url");
        expect(resource).toHaveProperty("size");
      });
    });
  });
});
