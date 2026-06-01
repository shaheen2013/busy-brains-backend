import { Test, TestingModule } from "@nestjs/testing";
import { PaymentController } from "./payment.controller";
import { PaymentService } from "./payment.service";
import { StartPlanDto } from "./dto/start-plan.dto";
import { User as UserEntity } from "../users/entities/user.entity";
import { PlanName } from "../subscriptions/entities/plan.entity";

const mockPaymentService = {
  startTrial: jest.fn(),
  startPlan: jest.fn(),
  upgradePlan: jest.fn(),
  getPaymentHistory: jest.fn(),
};

const mockUser: Partial<UserEntity> = {
  id: "user-id-1",
  name: "Test User",
  email: "test@example.com",
  stripeCustomerId: null,
};

describe("PaymentController", () => {
  let controller: PaymentController;
  let service: typeof mockPaymentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [{ provide: PaymentService, useValue: mockPaymentService }],
    }).compile();

    controller = module.get<PaymentController>(PaymentController);
    service = module.get(PaymentService);

    jest.clearAllMocks();
  });

  describe("startTrial", () => {
    it("should call paymentService.startTrial with the user and return the result", async () => {
      const trialPlan = {
        id: "up-1",
        userId: mockUser.id,
        isTrial: true,
        isActive: true,
      };
      service.startTrial.mockResolvedValue(trialPlan);

      const result = await controller.startTrial(mockUser as UserEntity);

      expect(service.startTrial).toHaveBeenCalledWith(mockUser);
      expect(result).toBe(trialPlan);
    });
  });

  describe("startPlan", () => {
    it("should call paymentService.startPlan with the user and planName from dto", async () => {
      const dto: StartPlanDto = { planName: PlanName.SOLO_EXPLORER };
      const session = {
        sessionId: "cs_test_123",
        url: "https://checkout.stripe.com/cs_test_123",
      };
      service.startPlan.mockResolvedValue(session);

      const result = await controller.startPlan(mockUser as UserEntity, dto);

      expect(service.startPlan).toHaveBeenCalledWith(mockUser, dto.planName);
      expect(result).toBe(session);
    });

    it("should pass FAMILY_PACK planName correctly", async () => {
      const dto: StartPlanDto = { planName: PlanName.FAMILY_PACK };
      const session = {
        sessionId: "cs_test_456",
        url: "https://checkout.stripe.com/cs_test_456",
      };
      service.startPlan.mockResolvedValue(session);

      const result = await controller.startPlan(mockUser as UserEntity, dto);

      expect(service.startPlan).toHaveBeenCalledWith(
        mockUser,
        PlanName.FAMILY_PACK,
      );
      expect(result).toBe(session);
    });
  });

  describe("upgradePlan", () => {
    it("should call paymentService.upgradePlan with the user and return the result", async () => {
      const session = {
        sessionId: "cs_upgrade_123",
        url: "https://checkout.stripe.com/cs_upgrade_123",
      };
      service.upgradePlan.mockResolvedValue(session);

      const result = await controller.upgradePlan(mockUser as UserEntity);

      expect(service.upgradePlan).toHaveBeenCalledWith(mockUser);
      expect(result).toBe(session);
    });
  });

  describe("getHistory", () => {
    it("should call paymentService.getPaymentHistory with user.id and return the result", async () => {
      const history = [
        { id: "ph-1", userId: mockUser.id, amount: 4900, status: "succeeded" },
      ];
      service.getPaymentHistory.mockResolvedValue(history);

      const result = await controller.getHistory(mockUser as UserEntity);

      expect(service.getPaymentHistory).toHaveBeenCalledWith(mockUser.id);
      expect(result).toBe(history);
    });

    it("should return an empty array when there is no payment history", async () => {
      service.getPaymentHistory.mockResolvedValue([]);

      const result = await controller.getHistory(mockUser as UserEntity);

      expect(service.getPaymentHistory).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual([]);
    });
  });
});
