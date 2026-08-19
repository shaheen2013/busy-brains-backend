// Capture the shared stripe mock instance at factory time so we can reference
// it from tests regardless of jest.clearAllMocks() clearing constructor results.
const stripeMockInstance = {
  customers: { create: jest.fn() },
  checkout: { sessions: { create: jest.fn() } },
  invoices: { retrieve: jest.fn() },
};

// Mock the stripe module BEFORE any imports that load it
jest.mock("stripe", () => {
  return jest.fn().mockImplementation(() => stripeMockInstance);
});

import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { PaymentService } from "./payment.service";
import { Plan, PlanName } from "../subscriptions/entities/plan.entity";
import { UserPlan } from "../subscriptions/entities/user-plan.entity";
import { PaymentHistory } from "../subscriptions/entities/payment-history.entity";
import { WeeklyPaymentHistory } from "../subscriptions/entities/weekly-payment-history.entity";
import { User } from "../users/entities/user.entity";

const createMockRepository = () => ({
  findOne: jest.fn(),
  findOneBy: jest.fn(),
  find: jest.fn(),
  findBy: jest.fn(),
  save: jest.fn(),
  create: jest.fn().mockImplementation((data) => data),
  update: jest.fn(),
  delete: jest.fn(),
  remove: jest.fn(),
  countBy: jest.fn(),
  count: jest.fn(),
});

describe("PaymentService", () => {
  let service: PaymentService;

  let planRepo: ReturnType<typeof createMockRepository>;
  let userPlanRepo: ReturnType<typeof createMockRepository>;
  let paymentHistoryRepo: ReturnType<typeof createMockRepository>;
  let weeklyPaymentHistoryRepo: ReturnType<typeof createMockRepository>;
  let userRepo: ReturnType<typeof createMockRepository>;
  let configService: { get: jest.Mock };

  const userId = "user-id-1";

  // mockUser is recreated in beforeEach to prevent mutation side-effects
  // (the service mutates user.stripeCustomerId during customer creation)
  let mockUser: Partial<User>;

  const stripeConfig = {
    secretKey: "sk_test_123",
    publishableKey: "pk_test_123",
    webhookSecret: "whsec_test",
    upgradePriceId: "price_upgrade",
  };

  beforeEach(async () => {
    // Recreate mockUser every test to prevent mutation side-effects from the
    // service assigning user.stripeCustomerId when creating a Stripe customer.
    mockUser = {
      id: userId,
      name: "Test User",
      email: "test@example.com",
      stripeCustomerId: null,
    };

    planRepo = createMockRepository();
    userPlanRepo = createMockRepository();
    paymentHistoryRepo = createMockRepository();
    weeklyPaymentHistoryRepo = createMockRepository();
    weeklyPaymentHistoryRepo.find.mockResolvedValue([]);
    userRepo = createMockRepository();

    configService = {
      get: jest.fn((key: string) => {
        if (key === "stripe") return stripeConfig;
        if (key === "frontendUrl") return "http://localhost:3000";
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: getRepositoryToken(Plan), useValue: planRepo },
        { provide: getRepositoryToken(UserPlan), useValue: userPlanRepo },
        {
          provide: getRepositoryToken(PaymentHistory),
          useValue: paymentHistoryRepo,
        },
        {
          provide: getRepositoryToken(WeeklyPaymentHistory),
          useValue: weeklyPaymentHistoryRepo,
        },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);

    // Reset all repository and service mocks between tests.
    // We reset stripeMockInstance methods individually so the shared reference
    // remains valid even after jest.clearAllMocks() clears constructor results.
    jest.clearAllMocks();

    // Re-wire stripe mock methods after clearAllMocks
    stripeMockInstance.customers.create = jest.fn();
    stripeMockInstance.checkout.sessions.create = jest.fn();
    stripeMockInstance.invoices.retrieve = jest.fn();

    // Restore configService.get after clearAllMocks
    configService.get.mockImplementation((key: string) => {
      if (key === "stripe") return stripeConfig;
      if (key === "frontendUrl") return "http://localhost:3000";
      return undefined;
    });
    // Restore create mocks
    planRepo.create.mockImplementation((data) => data);
    userPlanRepo.create.mockImplementation((data) => data);
    paymentHistoryRepo.create.mockImplementation((data) => data);
  });

  // ---------------------------------------------------------------------------
  // startTrial
  // ---------------------------------------------------------------------------

  describe("startTrial", () => {
    it("should throw ConflictException when user already has an active plan", async () => {
      userPlanRepo.findOne.mockResolvedValue({
        id: "up-1",
        userId,
        isActive: true,
        isTrial: false,
      });

      await expect(service.startTrial(mockUser as User)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.startTrial(mockUser as User)).rejects.toThrow(
        "User already has an active plan or trial",
      );
    });

    it("should create and return a 14-day trial UserPlan", async () => {
      userPlanRepo.findOne.mockResolvedValue(null);
      const savedPlan = {
        id: "up-new",
        userId,
        isTrial: true,
        isActive: true,
        planId: null,
      };
      userPlanRepo.save.mockResolvedValue(savedPlan);

      const result = await service.startTrial(mockUser as User);

      expect(userPlanRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          planId: null,
          isTrial: true,
          isActive: true,
        }),
      );
      expect(userPlanRepo.save).toHaveBeenCalled();
      expect(result).toBe(savedPlan);
    });

    it("should create a trial even when user already has a trial that was inactive", async () => {
      // findOne returns null means no active plan
      userPlanRepo.findOne.mockResolvedValue(null);
      const savedPlan = { id: "up-new", userId, isTrial: true, isActive: true };
      userPlanRepo.save.mockResolvedValue(savedPlan);

      const result = await service.startTrial(mockUser as User);

      expect(result).toBe(savedPlan);
    });
  });

  // ---------------------------------------------------------------------------
  // startPlan
  // ---------------------------------------------------------------------------

  describe("startPlan", () => {
    it("should throw ConflictException when user has an active non-trial plan", async () => {
      userPlanRepo.findOne.mockResolvedValue({
        id: "up-1",
        userId,
        isActive: true,
        isTrial: false,
      });

      await expect(
        service.startPlan(mockUser as User, PlanName.SOLO_EXPLORER),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.startPlan(mockUser as User, PlanName.SOLO_EXPLORER),
      ).rejects.toThrow("User already has an active plan");
    });

    it("should throw NotFoundException when plan is not found", async () => {
      userPlanRepo.findOne.mockResolvedValue(null);
      planRepo.findOne.mockResolvedValue(null);

      await expect(
        service.startPlan(mockUser as User, PlanName.SOLO_EXPLORER),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.startPlan(mockUser as User, PlanName.SOLO_EXPLORER),
      ).rejects.toThrow(`Plan "SOLO_EXPLORER" not found`);
    });

    it("should allow starting a plan when there is only an active trial", async () => {
      userPlanRepo.findOne.mockResolvedValue({
        id: "up-1",
        userId,
        isActive: true,
        isTrial: true,
      });
      const plan = {
        id: "plan-1",
        name: PlanName.SOLO_EXPLORER,
        stripePriceId: "price_solo",
        maxChildren: 1,
      };
      planRepo.findOne.mockResolvedValue(plan);

      const stripeInstance = stripeMockInstance;
      stripeInstance.customers.create.mockResolvedValue({ id: "cus_new" });
      stripeInstance.checkout.sessions.create.mockResolvedValue({
        id: "cs_test_123",
        url: "https://checkout.stripe.com/cs_test_123",
      });
      userRepo.save.mockResolvedValue({
        ...mockUser,
        stripeCustomerId: "cus_new",
      });

      const result = await service.startPlan(
        mockUser as User,
        PlanName.SOLO_EXPLORER,
      );

      expect(result).toEqual({
        sessionId: "cs_test_123",
        url: "https://checkout.stripe.com/cs_test_123",
      });
    });

    it("should create a new Stripe customer when user has no stripeCustomerId", async () => {
      userPlanRepo.findOne.mockResolvedValue(null);
      const plan = {
        id: "plan-1",
        name: PlanName.SOLO_EXPLORER,
        stripePriceId: "price_solo",
        maxChildren: 1,
      };
      planRepo.findOne.mockResolvedValue(plan);

      const stripeInstance = stripeMockInstance;
      stripeInstance.customers.create.mockResolvedValue({ id: "cus_new" });
      stripeInstance.checkout.sessions.create.mockResolvedValue({
        id: "cs_test_123",
        url: "https://checkout.stripe.com/cs_test_123",
      });
      userRepo.save.mockResolvedValue({
        ...mockUser,
        stripeCustomerId: "cus_new",
      });

      await service.startPlan(mockUser as User, PlanName.SOLO_EXPLORER);

      expect(stripeInstance.customers.create).toHaveBeenCalledWith({
        email: mockUser.email,
        metadata: { userId },
      });
      expect(userRepo.save).toHaveBeenCalled();
    });

    it("should skip creating a Stripe customer when user already has stripeCustomerId", async () => {
      const userWithStripe = { ...mockUser, stripeCustomerId: "cus_existing" };
      userPlanRepo.findOne.mockResolvedValue(null);
      const plan = {
        id: "plan-1",
        name: PlanName.SOLO_EXPLORER,
        stripePriceId: "price_solo",
      };
      planRepo.findOne.mockResolvedValue(plan);

      const stripeInstance = stripeMockInstance;
      stripeInstance.checkout.sessions.create.mockResolvedValue({
        id: "cs_test_456",
        url: "https://checkout.stripe.com/cs_test_456",
      });

      const result = await service.startPlan(
        userWithStripe as User,
        PlanName.SOLO_EXPLORER,
      );

      expect(stripeInstance.customers.create).not.toHaveBeenCalled();
      expect(result).toEqual({
        sessionId: "cs_test_456",
        url: "https://checkout.stripe.com/cs_test_456",
      });
    });

    it("should return empty url when Stripe session url is null", async () => {
      userPlanRepo.findOne.mockResolvedValue(null);
      planRepo.findOne.mockResolvedValue({
        id: "plan-1",
        name: PlanName.SOLO_EXPLORER,
        stripePriceId: "price_solo",
      });

      const stripeInstance = stripeMockInstance;
      stripeInstance.customers.create.mockResolvedValue({ id: "cus_new" });
      stripeInstance.checkout.sessions.create.mockResolvedValue({
        id: "cs_no_url",
        url: null,
      });
      userRepo.save.mockResolvedValue(mockUser);

      const result = await service.startPlan(
        mockUser as User,
        PlanName.SOLO_EXPLORER,
      );

      expect(result).toEqual({ sessionId: "cs_no_url", url: "" });
    });
  });

  // ---------------------------------------------------------------------------
  // upgradePlan
  // ---------------------------------------------------------------------------

  describe("upgradePlan", () => {
    it("should throw ConflictException when user has no active plan", async () => {
      userPlanRepo.findOne.mockResolvedValue(null);

      await expect(service.upgradePlan(mockUser as User)).rejects.toThrow(
        ConflictException,
      );
    });

    it("should throw ConflictException when user is on a trial", async () => {
      userPlanRepo.findOne.mockResolvedValue({
        id: "up-1",
        userId,
        isActive: true,
        isTrial: true,
        plan: null,
      });

      await expect(service.upgradePlan(mockUser as User)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.upgradePlan(mockUser as User)).rejects.toThrow(
        "Upgrade is only available for active Solo Explorer subscribers",
      );
    });

    it("should throw ConflictException when user is on FAMILY_PACK already", async () => {
      userPlanRepo.findOne.mockResolvedValue({
        id: "up-1",
        userId,
        isActive: true,
        isTrial: false,
        plan: { name: PlanName.FAMILY_PACK },
      });

      await expect(service.upgradePlan(mockUser as User)).rejects.toThrow(
        ConflictException,
      );
    });

    it("should throw NotFoundException when FAMILY_PACK plan is not found in DB", async () => {
      userPlanRepo.findOne.mockResolvedValue({
        id: "up-1",
        userId,
        isActive: true,
        isTrial: false,
        plan: { name: PlanName.SOLO_EXPLORER },
      });
      planRepo.findOne.mockResolvedValue(null);

      await expect(service.upgradePlan(mockUser as User)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.upgradePlan(mockUser as User)).rejects.toThrow(
        `Plan "FAMILY_PACK" not found`,
      );
    });

    it("should create Stripe checkout session for upgrade with upgradePriceId", async () => {
      userPlanRepo.findOne.mockResolvedValue({
        id: "up-1",
        userId,
        isActive: true,
        isTrial: false,
        plan: { name: PlanName.SOLO_EXPLORER },
      });
      const familyPlan = {
        id: "plan-2",
        name: PlanName.FAMILY_PACK,
        stripePriceId: "price_family",
      };
      planRepo.findOne.mockResolvedValue(familyPlan);

      const stripeInstance = stripeMockInstance;
      stripeInstance.customers.create.mockResolvedValue({ id: "cus_new" });
      stripeInstance.checkout.sessions.create.mockResolvedValue({
        id: "cs_upgrade_123",
        url: "https://checkout.stripe.com/cs_upgrade_123",
      });
      userRepo.save.mockResolvedValue({
        ...mockUser,
        stripeCustomerId: "cus_new",
      });

      const result = await service.upgradePlan(mockUser as User);

      expect(stripeInstance.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [{ price: stripeConfig.upgradePriceId, quantity: 1 }],
          metadata: expect.objectContaining({
            planName: PlanName.FAMILY_PACK,
            isUpgrade: "true",
          }),
        }),
      );
      expect(result).toEqual({
        sessionId: "cs_upgrade_123",
        url: "https://checkout.stripe.com/cs_upgrade_123",
      });
    });

    it("should skip customer creation if user already has stripeCustomerId", async () => {
      const userWithStripe = { ...mockUser, stripeCustomerId: "cus_existing" };
      userPlanRepo.findOne.mockResolvedValue({
        id: "up-1",
        userId,
        isActive: true,
        isTrial: false,
        plan: { name: PlanName.SOLO_EXPLORER },
      });
      planRepo.findOne.mockResolvedValue({
        id: "plan-2",
        name: PlanName.FAMILY_PACK,
        stripePriceId: "price_family",
      });

      const stripeInstance = stripeMockInstance;
      stripeInstance.checkout.sessions.create.mockResolvedValue({
        id: "cs_upgrade_456",
        url: "https://checkout.stripe.com/cs_upgrade_456",
      });

      await service.upgradePlan(userWithStripe as User);

      expect(stripeInstance.customers.create).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // handlePaymentIntentSucceeded
  // ---------------------------------------------------------------------------

  describe("handlePaymentIntentSucceeded", () => {
    it("should update status to succeeded when record already exists", async () => {
      const piId = "pi_123";
      const existing = {
        id: "ph-1",
        stripePaymentIntentId: piId,
        status: "pending",
      };
      paymentHistoryRepo.findOne.mockResolvedValue(existing);
      paymentHistoryRepo.save.mockResolvedValue({
        ...existing,
        status: "succeeded",
      });

      await service.handlePaymentIntentSucceeded(piId, 4900, "usd");

      expect(paymentHistoryRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: "succeeded" }),
      );
    });

    it("should create a partial record when no existing record is found", async () => {
      const piId = "pi_new";
      paymentHistoryRepo.findOne.mockResolvedValue(null);
      paymentHistoryRepo.save.mockResolvedValue({
        id: "ph-new",
        stripePaymentIntentId: piId,
        status: "succeeded",
      });

      await service.handlePaymentIntentSucceeded(piId, 4900, "usd");

      expect(paymentHistoryRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          stripePaymentIntentId: piId,
          status: "succeeded",
          amount: 4900,
          currency: "usd",
        }),
      );
      expect(paymentHistoryRepo.save).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // handlePaymentIntentFailed
  // ---------------------------------------------------------------------------

  describe("handlePaymentIntentFailed", () => {
    it("should update status to failed and deactivate userPlan when record with paymentId exists", async () => {
      const piId = "pi_fail_123";
      const existing = {
        id: "ph-1",
        stripePaymentIntentId: piId,
        status: "pending",
        paymentId: "up-1",
      };
      paymentHistoryRepo.findOne.mockResolvedValue(existing);
      paymentHistoryRepo.save.mockResolvedValue({
        ...existing,
        status: "failed",
      });
      userPlanRepo.update.mockResolvedValue(undefined);

      await service.handlePaymentIntentFailed(piId);

      expect(paymentHistoryRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: "failed" }),
      );
      expect(userPlanRepo.update).toHaveBeenCalledWith("up-1", {
        isActive: false,
      });
    });

    it("should update status to failed without updating userPlan when paymentId is null", async () => {
      const piId = "pi_fail_no_plan";
      const existing = {
        id: "ph-1",
        stripePaymentIntentId: piId,
        status: "pending",
        paymentId: null,
      };
      paymentHistoryRepo.findOne.mockResolvedValue(existing);
      paymentHistoryRepo.save.mockResolvedValue({
        ...existing,
        status: "failed",
      });

      await service.handlePaymentIntentFailed(piId);

      expect(paymentHistoryRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: "failed" }),
      );
      expect(userPlanRepo.update).not.toHaveBeenCalled();
    });

    it("should create a partial failed record when no existing record is found", async () => {
      const piId = "pi_fail_new";
      paymentHistoryRepo.findOne.mockResolvedValue(null);
      paymentHistoryRepo.save.mockResolvedValue({
        id: "ph-new",
        status: "failed",
      });

      await service.handlePaymentIntentFailed(piId);

      expect(paymentHistoryRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          stripePaymentIntentId: piId,
          status: "failed",
        }),
      );
      expect(paymentHistoryRepo.save).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // handleCheckoutCompleted
  // ---------------------------------------------------------------------------

  describe("handleCheckoutCompleted", () => {
    const session = {
      id: "cs_test_123",
      payment_intent: "pi_123",
      amount_total: 4900,
      currency: "usd",
    };

    it("should return early when plan is not found", async () => {
      planRepo.findOne.mockResolvedValue(null);

      await service.handleCheckoutCompleted(
        userId,
        PlanName.SOLO_EXPLORER,
        session,
      );

      expect(userPlanRepo.findOne).not.toHaveBeenCalled();
      expect(paymentHistoryRepo.save).not.toHaveBeenCalled();
    });

    it("should return early when payment_intent is missing from session", async () => {
      const plan = { id: "plan-1", name: PlanName.SOLO_EXPLORER };
      planRepo.findOne.mockResolvedValue(plan);

      const sessionNoPI = { ...session, payment_intent: null };
      await service.handleCheckoutCompleted(
        userId,
        PlanName.SOLO_EXPLORER,
        sessionNoPI,
      );

      expect(userPlanRepo.save).not.toHaveBeenCalled();
    });

    it("should update existing UserPlan and existing PaymentHistory record", async () => {
      const plan = { id: "plan-1", name: PlanName.SOLO_EXPLORER };
      planRepo.findOne.mockResolvedValue(plan);

      const existingUserPlan = {
        id: "up-1",
        userId,
        isTrial: true,
        isActive: true,
      };
      userPlanRepo.findOne.mockResolvedValue(existingUserPlan);
      const savedUserPlan = {
        ...existingUserPlan,
        planId: plan.id,
        isTrial: false,
        isActive: true,
      };
      userPlanRepo.save.mockResolvedValue(savedUserPlan);

      const existingPayment = {
        id: "ph-1",
        stripePaymentIntentId: "pi_123",
        status: "succeeded",
        amount: 4900,
      };
      paymentHistoryRepo.findOne.mockResolvedValue(existingPayment);
      paymentHistoryRepo.save.mockResolvedValue({
        ...existingPayment,
        userId,
        planId: plan.id,
      });

      await service.handleCheckoutCompleted(
        userId,
        PlanName.SOLO_EXPLORER,
        session,
      );

      expect(userPlanRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          planId: plan.id,
          isTrial: false,
          isActive: true,
        }),
      );
      expect(paymentHistoryRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ userId, planId: plan.id }),
      );
    });

    it("should create a new UserPlan when none exists", async () => {
      const plan = { id: "plan-1", name: PlanName.SOLO_EXPLORER };
      planRepo.findOne.mockResolvedValue(plan);

      userPlanRepo.findOne.mockResolvedValue(null);
      const newUserPlan = {
        id: "up-new",
        userId,
        planId: plan.id,
        isTrial: false,
        isActive: true,
      };
      userPlanRepo.save.mockResolvedValue(newUserPlan);
      userPlanRepo.create.mockImplementation((data) => data);

      paymentHistoryRepo.findOne.mockResolvedValue(null);
      paymentHistoryRepo.save.mockResolvedValue({ id: "ph-new" });
      paymentHistoryRepo.create.mockImplementation((data) => data);

      await service.handleCheckoutCompleted(
        userId,
        PlanName.SOLO_EXPLORER,
        session,
      );

      expect(userPlanRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          planId: plan.id,
          isTrial: false,
          isActive: true,
        }),
      );
    });

    it("should create a new PaymentHistory record when none exists", async () => {
      const plan = { id: "plan-1", name: PlanName.SOLO_EXPLORER };
      planRepo.findOne.mockResolvedValue(plan);

      const newUserPlan = { id: "up-new" };
      userPlanRepo.findOne.mockResolvedValue(null);
      userPlanRepo.save.mockResolvedValue(newUserPlan);
      userPlanRepo.create.mockImplementation((data) => data);

      paymentHistoryRepo.findOne.mockResolvedValue(null);
      paymentHistoryRepo.save.mockResolvedValue({ id: "ph-new" });
      paymentHistoryRepo.create.mockImplementation((data) => data);

      await service.handleCheckoutCompleted(
        userId,
        PlanName.SOLO_EXPLORER,
        session,
      );

      expect(paymentHistoryRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          planId: plan.id,
          amount: session.amount_total,
          currency: session.currency,
          stripePaymentIntentId: session.payment_intent,
          stripeCheckoutSessionId: session.id,
          status: "processing",
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // handleInvoicePaid
  // ---------------------------------------------------------------------------

  describe("handleInvoicePaid", () => {
    it("should update existing PaymentHistory record with the invoice PDF URL", async () => {
      const stripeInstance = stripeMockInstance;
      stripeInstance.invoices.retrieve.mockResolvedValue({
        id: "in_123",
        payment_intent: "pi_123",
        invoice_pdf: "https://stripe.com/invoices/in_123.pdf",
      });

      const existing = {
        id: "ph-1",
        stripePaymentIntentId: "pi_123",
        invoicePdfUrl: null,
      };
      paymentHistoryRepo.findOne.mockResolvedValue(existing);
      paymentHistoryRepo.save.mockResolvedValue({
        ...existing,
        invoicePdfUrl: "https://stripe.com/invoices/in_123.pdf",
      });

      await service.handleInvoicePaid("in_123", null);

      expect(paymentHistoryRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          invoicePdfUrl: "https://stripe.com/invoices/in_123.pdf",
        }),
      );
    });

    it("should create a stub PaymentHistory when record does not exist", async () => {
      const stripeInstance = stripeMockInstance;
      stripeInstance.invoices.retrieve.mockResolvedValue({
        id: "in_456",
        payment_intent: "pi_456",
        invoice_pdf: "https://stripe.com/invoices/in_456.pdf",
      });

      paymentHistoryRepo.findOne.mockResolvedValue(null);
      paymentHistoryRepo.save.mockResolvedValue({ id: "ph-stub" });
      paymentHistoryRepo.create.mockImplementation((data) => data);

      await service.handleInvoicePaid("in_456", null);

      expect(paymentHistoryRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          stripePaymentIntentId: "pi_456",
          invoicePdfUrl: "https://stripe.com/invoices/in_456.pdf",
          status: "pending",
        }),
      );
    });

    it("should use expanded payment_intent.id when payment_intent is an object", async () => {
      const stripeInstance = stripeMockInstance;
      stripeInstance.invoices.retrieve.mockResolvedValue({
        id: "in_789",
        payment_intent: { id: "pi_789" }, // expanded object form
        invoice_pdf: "https://stripe.com/invoices/in_789.pdf",
      });

      paymentHistoryRepo.findOne.mockResolvedValue(null);
      paymentHistoryRepo.save.mockResolvedValue({ id: "ph-stub" });
      paymentHistoryRepo.create.mockImplementation((data) => data);

      await service.handleInvoicePaid("in_789", null);

      expect(paymentHistoryRepo.findOne).toHaveBeenCalledWith({
        where: { stripePaymentIntentId: "pi_789" },
      });
    });

    it("should use the event payload PDF URL when invoice_pdf is null", async () => {
      const stripeInstance = stripeMockInstance;
      stripeInstance.invoices.retrieve.mockResolvedValue({
        id: "in_101",
        payment_intent: "pi_101",
        invoice_pdf: null,
      });

      paymentHistoryRepo.findOne.mockResolvedValue(null);
      paymentHistoryRepo.save.mockResolvedValue({ id: "ph-stub" });
      paymentHistoryRepo.create.mockImplementation((data) => data);

      await service.handleInvoicePaid("in_101", "https://fallback.pdf");

      expect(paymentHistoryRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          invoicePdfUrl: "https://fallback.pdf",
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // getPaymentHistory
  // ---------------------------------------------------------------------------

  describe("getPaymentHistory", () => {
    it("should return merged one-time payment history with plan relations for a given userId", async () => {
      const history = [
        {
          id: "ph-1",
          userId,
          amount: 4900,
          currency: "usd",
          status: "succeeded",
          createdAt: new Date("2026-01-01"),
          invoicePdfUrl: null,
          plan: { name: PlanName.SOLO_EXPLORER },
        },
      ];
      paymentHistoryRepo.find.mockResolvedValue(history);

      const result = await service.getPaymentHistory(userId);

      expect(paymentHistoryRepo.find).toHaveBeenCalledWith({
        where: { userId },
        relations: { plan: true },
        order: { createdAt: "DESC" },
      });
      expect(result).toEqual([
        {
          id: "ph-1",
          type: "one_time",
          amount: 4900,
          currency: "usd",
          status: "succeeded",
          createdAt: history[0].createdAt,
          invoicePdfUrl: null,
          planName: PlanName.SOLO_EXPLORER,
          weeklyTier: null,
          cycleNumber: null,
          isPayoff: false,
          isUpgrade: false,
          upgradeFromTier: null,
        },
      ]);
    });

    it("should return an empty array when there is no history", async () => {
      paymentHistoryRepo.find.mockResolvedValue([]);

      const result = await service.getPaymentHistory(userId);

      expect(result).toEqual([]);
    });
  });
});
