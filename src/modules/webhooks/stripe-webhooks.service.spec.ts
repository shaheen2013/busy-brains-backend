import { Test, TestingModule } from "@nestjs/testing";
import { StripeWebhooksService } from "./stripe-webhooks.service";
import { PaymentService } from "../payment/payment.service";
import { KitService } from "../kit/kit.service";
import { WeeklySubscriptionService } from "../weekly-subscription/weekly-subscription.service";
import { PlanName } from "../subscriptions/entities/plan.entity";

// ---------------------------------------------------------------------------
// Helpers to build Stripe event payloads
// ---------------------------------------------------------------------------
const buildCheckoutEvent = (overrides: Record<string, any> = {}) => ({
  type: "checkout.session.completed",
  data: {
    object: {
      id: "cs_test_123",
      payment_intent: "pi_test_456",
      amount_total: 9900,
      currency: "usd",
      metadata: {
        userId: "user-1",
        planName: PlanName.SOLO_EXPLORER,
      },
      ...overrides,
    },
  },
});

const buildPaymentIntentSucceededEvent = (
  overrides: Record<string, any> = {},
) => ({
  type: "payment_intent.succeeded",
  data: {
    object: {
      id: "pi_succeeded_123",
      amount: 9900,
      currency: "usd",
      ...overrides,
    },
  },
});

const buildPaymentIntentFailedEvent = (
  overrides: Record<string, any> = {},
) => ({
  type: "payment_intent.payment_failed",
  data: {
    object: {
      id: "pi_failed_123",
      ...overrides,
    },
  },
});

const buildInvoicePaymentSucceededEvent = (
  overrides: Record<string, any> = {},
) => ({
  type: "invoice.payment_succeeded",
  data: {
    object: {
      id: "in_test_123",
      payment_intent: "pi_test_456",
      amount_paid: 9900,
      currency: "usd",
      invoice_pdf: "https://invoice.stripe.com/invoice.pdf",
      hosted_invoice_url: "https://invoice.stripe.com/invoice",
      ...overrides,
    },
  },
});

const buildInvoicePaymentFailedEvent = (
  overrides: Record<string, any> = {},
) => ({
  type: "invoice.payment_failed",
  data: {
    object: {
      id: "in_failed_123",
      payment_intent: null,
      amount_due: 9900,
      currency: "usd",
      ...overrides,
    },
  },
});

describe("StripeWebhooksService", () => {
  let service: StripeWebhooksService;
  let paymentService: {
    handleCheckoutCompleted: jest.Mock;
    handlePaymentIntentSucceeded: jest.Mock;
    handlePaymentIntentFailed: jest.Mock;
    handleInvoicePaid: jest.Mock;
  };
  let kitService: { subscribeToSequence: jest.Mock };
  let weeklySubscriptionService: {
    handleSubscriptionUpdated: jest.Mock;
    handleSubscriptionDeleted: jest.Mock;
    handleInvoicePaymentSucceeded: jest.Mock;
    handleInvoicePaymentFailed: jest.Mock;
  };

  beforeEach(async () => {
    paymentService = {
      handleCheckoutCompleted: jest.fn().mockResolvedValue(undefined),
      handlePaymentIntentSucceeded: jest.fn().mockResolvedValue(undefined),
      handlePaymentIntentFailed: jest.fn().mockResolvedValue(undefined),
      handleInvoicePaid: jest.fn().mockResolvedValue(undefined),
    };
    kitService = {
      subscribeToSequence: jest.fn().mockResolvedValue(undefined),
    };
    weeklySubscriptionService = {
      handleSubscriptionUpdated: jest.fn().mockResolvedValue(undefined),
      handleSubscriptionDeleted: jest.fn().mockResolvedValue(undefined),
      handleInvoicePaymentSucceeded: jest.fn().mockResolvedValue(undefined),
      handleInvoicePaymentFailed: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeWebhooksService,
        { provide: PaymentService, useValue: paymentService },
        { provide: KitService, useValue: kitService },
        {
          provide: WeeklySubscriptionService,
          useValue: weeklySubscriptionService,
        },
      ],
    }).compile();

    service = module.get<StripeWebhooksService>(StripeWebhooksService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // handleCheckoutCompleted
  // ---------------------------------------------------------------------------
  describe("handleCheckoutCompleted", () => {
    it("calls paymentService.handleCheckoutCompleted with correct args", async () => {
      const event = buildCheckoutEvent();

      await service.handleCheckoutCompleted(event as any);

      expect(paymentService.handleCheckoutCompleted).toHaveBeenCalledWith(
        "user-1",
        PlanName.SOLO_EXPLORER,
        {
          id: "cs_test_123",
          payment_intent: "pi_test_456",
          amount_total: 9900,
          currency: "usd",
        },
      );
    });

    it("calls kitService.subscribeToSequence when isUpgrade is not set", async () => {
      const event = buildCheckoutEvent();

      await service.handleCheckoutCompleted(event as any);

      expect(kitService.subscribeToSequence).toHaveBeenCalledWith("user-1");
    });

    it('calls kitService.subscribeToSequence when isUpgrade is explicitly "false"', async () => {
      const event = buildCheckoutEvent({
        metadata: {
          userId: "user-1",
          planName: PlanName.SOLO_EXPLORER,
          isUpgrade: "false",
        },
      });

      await service.handleCheckoutCompleted(event as any);

      expect(kitService.subscribeToSequence).toHaveBeenCalledWith("user-1");
    });

    it('skips kitService.subscribeToSequence when isUpgrade is "true"', async () => {
      const event = buildCheckoutEvent({
        metadata: {
          userId: "user-1",
          planName: PlanName.SOLO_EXPLORER,
          isUpgrade: "true",
        },
      });

      await service.handleCheckoutCompleted(event as any);

      expect(paymentService.handleCheckoutCompleted).toHaveBeenCalled();
      expect(kitService.subscribeToSequence).not.toHaveBeenCalled();
    });

    it("warns and returns early when userId is missing from metadata", async () => {
      const event = buildCheckoutEvent({
        metadata: { planName: PlanName.SOLO_EXPLORER },
      });

      await service.handleCheckoutCompleted(event as any);

      expect(paymentService.handleCheckoutCompleted).not.toHaveBeenCalled();
      expect(kitService.subscribeToSequence).not.toHaveBeenCalled();
    });

    it("warns and returns early when planName is missing from metadata", async () => {
      const event = buildCheckoutEvent({
        metadata: { userId: "user-1" },
      });

      await service.handleCheckoutCompleted(event as any);

      expect(paymentService.handleCheckoutCompleted).not.toHaveBeenCalled();
      expect(kitService.subscribeToSequence).not.toHaveBeenCalled();
    });

    it("warns and returns early when metadata is null", async () => {
      const event = buildCheckoutEvent({ metadata: null });

      await service.handleCheckoutCompleted(event as any);

      expect(paymentService.handleCheckoutCompleted).not.toHaveBeenCalled();
      expect(kitService.subscribeToSequence).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // handlePaymentIntentSucceeded
  // ---------------------------------------------------------------------------
  describe("handlePaymentIntentSucceeded", () => {
    it("delegates to paymentService.handlePaymentIntentSucceeded with correct args", async () => {
      const event = buildPaymentIntentSucceededEvent();

      await service.handlePaymentIntentSucceeded(event as any);

      expect(paymentService.handlePaymentIntentSucceeded).toHaveBeenCalledWith(
        "pi_succeeded_123",
        9900,
        "usd",
      );
    });
  });

  // ---------------------------------------------------------------------------
  // handlePaymentIntentFailed
  // ---------------------------------------------------------------------------
  describe("handlePaymentIntentFailed", () => {
    it("delegates to paymentService.handlePaymentIntentFailed with payment intent id", async () => {
      const event = buildPaymentIntentFailedEvent();

      await service.handlePaymentIntentFailed(event as any);

      expect(paymentService.handlePaymentIntentFailed).toHaveBeenCalledWith(
        "pi_failed_123",
      );
    });
  });

  // ---------------------------------------------------------------------------
  // handleInvoicePaymentSucceeded
  // ---------------------------------------------------------------------------
  describe("handleInvoicePaymentSucceeded", () => {
    it("delegates to paymentService.handleInvoicePaid with invoice id and pdf url", async () => {
      const event = buildInvoicePaymentSucceededEvent();

      await service.handleInvoicePaymentSucceeded(event as any);

      expect(paymentService.handleInvoicePaid).toHaveBeenCalledWith(
        "in_test_123",
        "https://invoice.stripe.com/invoice.pdf",
      );
    });

    it("passes null invoice_pdf when not present", async () => {
      const event = buildInvoicePaymentSucceededEvent({ invoice_pdf: null });

      await service.handleInvoicePaymentSucceeded(event as any);

      expect(paymentService.handleInvoicePaid).toHaveBeenCalledWith(
        "in_test_123",
        null,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // handleInvoicePaymentFailed
  // ---------------------------------------------------------------------------
  describe("handleInvoicePaymentFailed", () => {
    it("logs and does not throw (no paymentService call)", async () => {
      const event = buildInvoicePaymentFailedEvent();

      await expect(
        service.handleInvoicePaymentFailed(event as any),
      ).resolves.not.toThrow();

      // handleInvoicePaymentFailed only logs, does not call any service method
      expect(paymentService.handlePaymentIntentFailed).not.toHaveBeenCalled();
      expect(paymentService.handleInvoicePaid).not.toHaveBeenCalled();
    });
  });
});
