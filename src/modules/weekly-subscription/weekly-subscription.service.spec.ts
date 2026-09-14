const stripeMockInstance = {
  subscriptions: { retrieve: jest.fn(), update: jest.fn() },
  customers: { create: jest.fn() },
  checkout: { sessions: { create: jest.fn() } },
  paymentMethods: { attach: jest.fn(), retrieve: jest.fn() },
};

// Mock the stripe module BEFORE any imports that load it
jest.mock("stripe", () => {
  return jest.fn().mockImplementation(() => stripeMockInstance);
});

import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";
import { WeeklySubscriptionService } from "./weekly-subscription.service";
import { WeeklyPlan } from "../subscriptions/entities/weekly-plan.entity";
import {
  WeeklySubscription,
  WeeklySubscriptionStatus,
} from "../subscriptions/entities/weekly-subscription.entity";
import { WeeklyPaymentHistory } from "../subscriptions/entities/weekly-payment-history.entity";
import { User } from "../users/entities/user.entity";
import { VerificationService } from "../users/verification.service";
import { KitService } from "../kit/kit.service";
import { PaymentService } from "../payment/payment.service";

const createMockRepository = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn(),
  create: jest.fn().mockImplementation((data) => data),
  update: jest.fn(),
});

describe("WeeklySubscriptionService", () => {
  let service: WeeklySubscriptionService;
  let weeklyPlanRepo: ReturnType<typeof createMockRepository>;
  let weeklySubscriptionRepo: ReturnType<typeof createMockRepository>;
  let weeklyPaymentHistoryRepo: ReturnType<typeof createMockRepository>;
  let userRepo: ReturnType<typeof createMockRepository>;
  let paymentService: {
    deactivateActiveTrial: jest.Mock;
    hasActiveOneTimePlan: jest.Mock;
  };
  let configService: { get: jest.Mock };

  const stripeConfig = { secretKey: "sk_test_123" };

  beforeEach(async () => {
    weeklyPlanRepo = createMockRepository();
    weeklySubscriptionRepo = createMockRepository();
    weeklyPaymentHistoryRepo = createMockRepository();
    userRepo = createMockRepository();
    paymentService = {
      deactivateActiveTrial: jest.fn().mockResolvedValue(undefined),
      hasActiveOneTimePlan: jest.fn().mockResolvedValue(false),
    };
    configService = {
      get: jest.fn((key: string) =>
        key === "stripe" ? stripeConfig : undefined,
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WeeklySubscriptionService,
        { provide: getRepositoryToken(WeeklyPlan), useValue: weeklyPlanRepo },
        {
          provide: getRepositoryToken(WeeklySubscription),
          useValue: weeklySubscriptionRepo,
        },
        {
          provide: getRepositoryToken(WeeklyPaymentHistory),
          useValue: weeklyPaymentHistoryRepo,
        },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: ConfigService, useValue: configService },
        { provide: VerificationService, useValue: {} },
        { provide: KitService, useValue: {} },
        { provide: PaymentService, useValue: paymentService },
      ],
    }).compile();

    service = module.get<WeeklySubscriptionService>(WeeklySubscriptionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("handleStartCheckoutCompleted", () => {
    const session = {
      metadata: { userId: "user-1", weeklyPlanId: "plan-1" },
      subscription: "sub_123",
    };

    it("creates the weekly subscription and deactivates any active trial", async () => {
      weeklySubscriptionRepo.findOne.mockResolvedValueOnce(null); // idempotency check
      weeklyPlanRepo.findOne.mockResolvedValueOnce({
        id: "plan-1",
        totalCycles: 6,
      });
      userRepo.findOne.mockResolvedValueOnce({
        id: "user-1",
        stripeCustomerId: null,
      });

      await service.handleStartCheckoutCompleted(session);

      expect(weeklySubscriptionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          weeklyPlanId: "plan-1",
          stripeSubscriptionId: "sub_123",
          status: WeeklySubscriptionStatus.ACTIVE,
        }),
      );
      expect(paymentService.deactivateActiveTrial).toHaveBeenCalledWith(
        "user-1",
      );
    });

    it("is idempotent: skips creation and trial deactivation when already recorded", async () => {
      weeklySubscriptionRepo.findOne.mockResolvedValueOnce({
        id: "already-recorded",
      });

      await service.handleStartCheckoutCompleted(session);

      expect(weeklySubscriptionRepo.save).not.toHaveBeenCalled();
      expect(paymentService.deactivateActiveTrial).not.toHaveBeenCalled();
    });

    it("does nothing when required metadata is missing", async () => {
      await service.handleStartCheckoutCompleted({
        metadata: {},
        subscription: null,
      });

      expect(weeklySubscriptionRepo.save).not.toHaveBeenCalled();
      expect(paymentService.deactivateActiveTrial).not.toHaveBeenCalled();
    });

    it("does nothing when the weekly plan is not found", async () => {
      weeklySubscriptionRepo.findOne.mockResolvedValueOnce(null);
      weeklyPlanRepo.findOne.mockResolvedValueOnce(null);

      await service.handleStartCheckoutCompleted(session);

      expect(weeklySubscriptionRepo.save).not.toHaveBeenCalled();
      expect(paymentService.deactivateActiveTrial).not.toHaveBeenCalled();
    });
  });
});
