import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { StripeWebhookController } from "./stripe.controller";
import { StripeWebhooksService } from "./stripe-webhooks.service";

// ---------------------------------------------------------------------------
// Mock stripe so constructEvent is under our control
// ---------------------------------------------------------------------------
const mockConstructEvent = jest.fn();

jest.mock("stripe", () => {
  return jest.fn().mockImplementation(() => ({
    webhooks: {
      constructEvent: (...args: any[]) => mockConstructEvent(...args),
    },
  }));
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const buildRequest = (headers: Record<string, string> = {}) => ({
  rawBody: Buffer.from('{"id":"evt_1","type":"checkout.session.completed"}'),
  headers: {
    "stripe-signature": "test-signature",
    ...headers,
  },
});

const mockStripeWebhooksService = {
  handleCheckoutCompleted: jest.fn().mockResolvedValue(undefined),
  handleInvoicePaymentSucceeded: jest.fn().mockResolvedValue(undefined),
  handleInvoicePaymentFailed: jest.fn().mockResolvedValue(undefined),
  handlePaymentIntentSucceeded: jest.fn().mockResolvedValue(undefined),
  handlePaymentIntentFailed: jest.fn().mockResolvedValue(undefined),
};

const mockConfigValues: Record<string, any> = {
  stripe: { secretKey: "sk_test_123", webhookSecret: "whsec_test" },
};

const mockConfigService = {
  get: jest.fn((key: string) => mockConfigValues[key]),
};

describe("StripeWebhookController", () => {
  let controller: StripeWebhookController;
  let stripeWebhooksService: typeof mockStripeWebhooksService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StripeWebhookController],
      providers: [
        { provide: StripeWebhooksService, useValue: mockStripeWebhooksService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    controller = module.get<StripeWebhookController>(StripeWebhookController);
    stripeWebhooksService = module.get(StripeWebhooksService);
  });

  // -------------------------------------------------------------------------
  // Signature verification failure
  // -------------------------------------------------------------------------
  describe("handleStripeWebhook() – invalid signature", () => {
    it("should throw BadRequestException when constructEvent throws", async () => {
      mockConstructEvent.mockImplementation(() => {
        throw new Error("No signatures found matching the expected signature");
      });

      await expect(
        controller.handleStripeWebhook(buildRequest() as any),
      ).rejects.toThrow(BadRequestException);
    });

    it("should include the right message in the BadRequestException", async () => {
      mockConstructEvent.mockImplementation(() => {
        throw new Error("invalid");
      });

      await expect(
        controller.handleStripeWebhook(buildRequest() as any),
      ).rejects.toThrow("Invalid Stripe webhook signature");
    });
  });

  // -------------------------------------------------------------------------
  // checkout.session.completed
  // -------------------------------------------------------------------------
  describe("handleStripeWebhook() – checkout.session.completed", () => {
    const event = {
      type: "checkout.session.completed",
      data: { object: { id: "cs_1" } },
    };

    beforeEach(() => {
      mockConstructEvent.mockReturnValue(event);
    });

    it("should call handleCheckoutCompleted with the full event", async () => {
      await controller.handleStripeWebhook(buildRequest() as any);
      expect(
        stripeWebhooksService.handleCheckoutCompleted,
      ).toHaveBeenCalledWith(event);
    });

    it("should NOT call other handlers", async () => {
      await controller.handleStripeWebhook(buildRequest() as any);
      expect(
        stripeWebhooksService.handleInvoicePaymentSucceeded,
      ).not.toHaveBeenCalled();
      expect(
        stripeWebhooksService.handleInvoicePaymentFailed,
      ).not.toHaveBeenCalled();
      expect(
        stripeWebhooksService.handlePaymentIntentSucceeded,
      ).not.toHaveBeenCalled();
      expect(
        stripeWebhooksService.handlePaymentIntentFailed,
      ).not.toHaveBeenCalled();
    });

    it("should return { received: true }", async () => {
      const result = await controller.handleStripeWebhook(
        buildRequest() as any,
      );
      expect(result).toEqual({ received: true });
    });
  });

  // -------------------------------------------------------------------------
  // invoice.payment_succeeded
  // -------------------------------------------------------------------------
  describe("handleStripeWebhook() – invoice.payment_succeeded", () => {
    const event = {
      type: "invoice.payment_succeeded",
      data: { object: { id: "in_1" } },
    };

    beforeEach(() => {
      mockConstructEvent.mockReturnValue(event);
    });

    it("should call handleInvoicePaymentSucceeded with the full event", async () => {
      await controller.handleStripeWebhook(buildRequest() as any);
      expect(
        stripeWebhooksService.handleInvoicePaymentSucceeded,
      ).toHaveBeenCalledWith(event);
    });

    it("should NOT call other handlers", async () => {
      await controller.handleStripeWebhook(buildRequest() as any);
      expect(
        stripeWebhooksService.handleCheckoutCompleted,
      ).not.toHaveBeenCalled();
      expect(
        stripeWebhooksService.handleInvoicePaymentFailed,
      ).not.toHaveBeenCalled();
      expect(
        stripeWebhooksService.handlePaymentIntentSucceeded,
      ).not.toHaveBeenCalled();
      expect(
        stripeWebhooksService.handlePaymentIntentFailed,
      ).not.toHaveBeenCalled();
    });

    it("should return { received: true }", async () => {
      const result = await controller.handleStripeWebhook(
        buildRequest() as any,
      );
      expect(result).toEqual({ received: true });
    });
  });

  // -------------------------------------------------------------------------
  // invoice.payment_failed
  // -------------------------------------------------------------------------
  describe("handleStripeWebhook() – invoice.payment_failed", () => {
    const event = {
      type: "invoice.payment_failed",
      data: { object: { id: "in_2" } },
    };

    beforeEach(() => {
      mockConstructEvent.mockReturnValue(event);
    });

    it("should call handleInvoicePaymentFailed with the full event", async () => {
      await controller.handleStripeWebhook(buildRequest() as any);
      expect(
        stripeWebhooksService.handleInvoicePaymentFailed,
      ).toHaveBeenCalledWith(event);
    });

    it("should NOT call other handlers", async () => {
      await controller.handleStripeWebhook(buildRequest() as any);
      expect(
        stripeWebhooksService.handleCheckoutCompleted,
      ).not.toHaveBeenCalled();
      expect(
        stripeWebhooksService.handleInvoicePaymentSucceeded,
      ).not.toHaveBeenCalled();
      expect(
        stripeWebhooksService.handlePaymentIntentSucceeded,
      ).not.toHaveBeenCalled();
      expect(
        stripeWebhooksService.handlePaymentIntentFailed,
      ).not.toHaveBeenCalled();
    });

    it("should return { received: true }", async () => {
      const result = await controller.handleStripeWebhook(
        buildRequest() as any,
      );
      expect(result).toEqual({ received: true });
    });
  });

  // -------------------------------------------------------------------------
  // payment_intent.succeeded
  // -------------------------------------------------------------------------
  describe("handleStripeWebhook() – payment_intent.succeeded", () => {
    const event = {
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_1" } },
    };

    beforeEach(() => {
      mockConstructEvent.mockReturnValue(event);
    });

    it("should call handlePaymentIntentSucceeded with the full event", async () => {
      await controller.handleStripeWebhook(buildRequest() as any);
      expect(
        stripeWebhooksService.handlePaymentIntentSucceeded,
      ).toHaveBeenCalledWith(event);
    });

    it("should NOT call other handlers", async () => {
      await controller.handleStripeWebhook(buildRequest() as any);
      expect(
        stripeWebhooksService.handleCheckoutCompleted,
      ).not.toHaveBeenCalled();
      expect(
        stripeWebhooksService.handleInvoicePaymentSucceeded,
      ).not.toHaveBeenCalled();
      expect(
        stripeWebhooksService.handleInvoicePaymentFailed,
      ).not.toHaveBeenCalled();
      expect(
        stripeWebhooksService.handlePaymentIntentFailed,
      ).not.toHaveBeenCalled();
    });

    it("should return { received: true }", async () => {
      const result = await controller.handleStripeWebhook(
        buildRequest() as any,
      );
      expect(result).toEqual({ received: true });
    });
  });

  // -------------------------------------------------------------------------
  // payment_intent.payment_failed
  // -------------------------------------------------------------------------
  describe("handleStripeWebhook() – payment_intent.payment_failed", () => {
    const event = {
      type: "payment_intent.payment_failed",
      data: { object: { id: "pi_2" } },
    };

    beforeEach(() => {
      mockConstructEvent.mockReturnValue(event);
    });

    it("should call handlePaymentIntentFailed with the full event", async () => {
      await controller.handleStripeWebhook(buildRequest() as any);
      expect(
        stripeWebhooksService.handlePaymentIntentFailed,
      ).toHaveBeenCalledWith(event);
    });

    it("should NOT call other handlers", async () => {
      await controller.handleStripeWebhook(buildRequest() as any);
      expect(
        stripeWebhooksService.handleCheckoutCompleted,
      ).not.toHaveBeenCalled();
      expect(
        stripeWebhooksService.handleInvoicePaymentSucceeded,
      ).not.toHaveBeenCalled();
      expect(
        stripeWebhooksService.handleInvoicePaymentFailed,
      ).not.toHaveBeenCalled();
      expect(
        stripeWebhooksService.handlePaymentIntentSucceeded,
      ).not.toHaveBeenCalled();
    });

    it("should return { received: true }", async () => {
      const result = await controller.handleStripeWebhook(
        buildRequest() as any,
      );
      expect(result).toEqual({ received: true });
    });
  });

  // -------------------------------------------------------------------------
  // Unknown / unhandled event type
  // -------------------------------------------------------------------------
  describe("handleStripeWebhook() – unhandled event type", () => {
    it("should not call any handler for an unrecognised event type", async () => {
      mockConstructEvent.mockReturnValue({
        type: "customer.created",
        data: {},
      });

      const result = await controller.handleStripeWebhook(
        buildRequest() as any,
      );

      expect(
        stripeWebhooksService.handleCheckoutCompleted,
      ).not.toHaveBeenCalled();
      expect(
        stripeWebhooksService.handleInvoicePaymentSucceeded,
      ).not.toHaveBeenCalled();
      expect(
        stripeWebhooksService.handleInvoicePaymentFailed,
      ).not.toHaveBeenCalled();
      expect(
        stripeWebhooksService.handlePaymentIntentSucceeded,
      ).not.toHaveBeenCalled();
      expect(
        stripeWebhooksService.handlePaymentIntentFailed,
      ).not.toHaveBeenCalled();
      expect(result).toEqual({ received: true });
    });
  });

  // -------------------------------------------------------------------------
  // rawBody fallback
  // -------------------------------------------------------------------------
  describe("handleStripeWebhook() – rawBody fallback", () => {
    it("should handle requests without a rawBody (falls back to empty Buffer)", async () => {
      mockConstructEvent.mockReturnValue({
        type: "checkout.session.completed",
        data: { object: {} },
      });

      const req = {
        rawBody: undefined,
        headers: { "stripe-signature": "sig" },
      };
      const result = await controller.handleStripeWebhook(req as any);

      expect(result).toEqual({ received: true });
    });
  });

  // -------------------------------------------------------------------------
  // Stripe signature header is forwarded
  // -------------------------------------------------------------------------
  describe("handleStripeWebhook() – signature forwarding", () => {
    it("should pass the stripe-signature header to constructEvent", async () => {
      mockConstructEvent.mockReturnValue({
        type: "checkout.session.completed",
        data: { object: {} },
      });

      const req = buildRequest({ "stripe-signature": "v1,mysig" });
      await controller.handleStripeWebhook(req as any);

      expect(mockConstructEvent).toHaveBeenCalledWith(
        expect.anything(),
        "v1,mysig",
        expect.any(String),
      );
    });
  });
});
