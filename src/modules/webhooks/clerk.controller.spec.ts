import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ClerkWebhookController } from "./clerk.controller";
import { ClerkWebhooksService } from "./clerk-webhooks.service";

// ---------------------------------------------------------------------------
// Mock svix so we control signature verification without real HMAC logic
// ---------------------------------------------------------------------------
const mockSvixVerify = jest.fn();

jest.mock("svix", () => ({
  Webhook: jest.fn().mockImplementation(() => ({
    verify: mockSvixVerify,
  })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const buildRequest = (overrides: Partial<Record<string, any>> = {}) => ({
  rawBody: Buffer.from(
    JSON.stringify({ type: "user.created", data: { id: "u1" } }),
  ),
  headers: {
    "svix-id": "svix-id-value",
    "svix-timestamp": "1234567890",
    "svix-signature": "v1,signature",
    ...overrides.headers,
  },
  ...overrides,
});

const mockClerkWebhooksService = {
  handleUserCreated: jest.fn().mockResolvedValue(undefined),
  handleUserUpdated: jest.fn().mockResolvedValue(undefined),
  handleUserDeleted: jest.fn().mockResolvedValue(undefined),
};

const mockConfigValues: Record<string, any> = {
  clerk: { webhookSecret: "whsec_test_secret", secretKey: "sk_test" },
};

const mockConfigService = {
  get: jest.fn((key: string) => mockConfigValues[key]),
};

describe("ClerkWebhookController", () => {
  let controller: ClerkWebhookController;
  let clerkWebhooksService: typeof mockClerkWebhooksService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClerkWebhookController],
      providers: [
        { provide: ClerkWebhooksService, useValue: mockClerkWebhooksService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    controller = module.get<ClerkWebhookController>(ClerkWebhookController);
    clerkWebhooksService = module.get(ClerkWebhooksService);
  });

  // -------------------------------------------------------------------------
  // Signature verification failure
  // -------------------------------------------------------------------------
  describe("handleClerkWebhook() – invalid signature", () => {
    it("should throw BadRequestException when svix.verify throws", async () => {
      mockSvixVerify.mockImplementation(() => {
        throw new Error("invalid signature");
      });

      await expect(
        controller.handleClerkWebhook(buildRequest() as any),
      ).rejects.toThrow(BadRequestException);
    });

    it("should include the right message in the BadRequestException", async () => {
      mockSvixVerify.mockImplementation(() => {
        throw new Error("invalid");
      });

      await expect(
        controller.handleClerkWebhook(buildRequest() as any),
      ).rejects.toThrow("Invalid Clerk webhook signature");
    });
  });

  // -------------------------------------------------------------------------
  // user.created
  // -------------------------------------------------------------------------
  describe("handleClerkWebhook() – user.created", () => {
    const event = { type: "user.created", data: { id: "clerk-user-1" } };

    beforeEach(() => {
      mockSvixVerify.mockReturnValue(event);
    });

    it("should call handleUserCreated with the event", async () => {
      await controller.handleClerkWebhook(buildRequest() as any);
      expect(clerkWebhooksService.handleUserCreated).toHaveBeenCalledWith(
        event,
      );
    });

    it("should NOT call handleUserUpdated or handleUserDeleted", async () => {
      await controller.handleClerkWebhook(buildRequest() as any);
      expect(clerkWebhooksService.handleUserUpdated).not.toHaveBeenCalled();
      expect(clerkWebhooksService.handleUserDeleted).not.toHaveBeenCalled();
    });

    it("should return { received: true }", async () => {
      const result = await controller.handleClerkWebhook(buildRequest() as any);
      expect(result).toEqual({ received: true });
    });
  });

  // -------------------------------------------------------------------------
  // user.updated
  // -------------------------------------------------------------------------
  describe("handleClerkWebhook() – user.updated", () => {
    const event = { type: "user.updated", data: { id: "clerk-user-2" } };

    beforeEach(() => {
      mockSvixVerify.mockReturnValue(event);
    });

    it("should call handleUserUpdated with the event", async () => {
      await controller.handleClerkWebhook(buildRequest() as any);
      expect(clerkWebhooksService.handleUserUpdated).toHaveBeenCalledWith(
        event,
      );
    });

    it("should NOT call handleUserCreated or handleUserDeleted", async () => {
      await controller.handleClerkWebhook(buildRequest() as any);
      expect(clerkWebhooksService.handleUserCreated).not.toHaveBeenCalled();
      expect(clerkWebhooksService.handleUserDeleted).not.toHaveBeenCalled();
    });

    it("should return { received: true }", async () => {
      const result = await controller.handleClerkWebhook(buildRequest() as any);
      expect(result).toEqual({ received: true });
    });
  });

  // -------------------------------------------------------------------------
  // user.deleted
  // -------------------------------------------------------------------------
  describe("handleClerkWebhook() – user.deleted", () => {
    const event = { type: "user.deleted", data: { id: "clerk-user-3" } };

    beforeEach(() => {
      mockSvixVerify.mockReturnValue(event);
    });

    it("should call handleUserDeleted with the event", async () => {
      await controller.handleClerkWebhook(buildRequest() as any);
      expect(clerkWebhooksService.handleUserDeleted).toHaveBeenCalledWith(
        event,
      );
    });

    it("should NOT call handleUserCreated or handleUserUpdated", async () => {
      await controller.handleClerkWebhook(buildRequest() as any);
      expect(clerkWebhooksService.handleUserCreated).not.toHaveBeenCalled();
      expect(clerkWebhooksService.handleUserUpdated).not.toHaveBeenCalled();
    });

    it("should return { received: true }", async () => {
      const result = await controller.handleClerkWebhook(buildRequest() as any);
      expect(result).toEqual({ received: true });
    });
  });

  // -------------------------------------------------------------------------
  // Unknown event type
  // -------------------------------------------------------------------------
  describe("handleClerkWebhook() – unknown event type", () => {
    it("should not call any handler for an unrecognised event type", async () => {
      mockSvixVerify.mockReturnValue({ type: "session.created", data: {} });

      const result = await controller.handleClerkWebhook(buildRequest() as any);

      expect(clerkWebhooksService.handleUserCreated).not.toHaveBeenCalled();
      expect(clerkWebhooksService.handleUserUpdated).not.toHaveBeenCalled();
      expect(clerkWebhooksService.handleUserDeleted).not.toHaveBeenCalled();
      expect(result).toEqual({ received: true });
    });
  });

  // -------------------------------------------------------------------------
  // rawBody fallback
  // -------------------------------------------------------------------------
  describe("handleClerkWebhook() – rawBody fallback", () => {
    it("should handle requests without a rawBody (falls back to empty Buffer)", async () => {
      const event = { type: "user.created", data: { id: "u99" } };
      mockSvixVerify.mockReturnValue(event);

      const req = buildRequest({ rawBody: undefined });
      const result = await controller.handleClerkWebhook(req as any);

      expect(result).toEqual({ received: true });
    });
  });

  // -------------------------------------------------------------------------
  // Svix headers are forwarded
  // -------------------------------------------------------------------------
  describe("handleClerkWebhook() – svix header forwarding", () => {
    it("should pass svix headers to wh.verify", async () => {
      const event = { type: "user.created", data: {} };
      mockSvixVerify.mockReturnValue(event);

      const headers = {
        "svix-id": "test-svix-id",
        "svix-timestamp": "9999999",
        "svix-signature": "v1,abc123",
      };

      await controller.handleClerkWebhook(buildRequest({ headers }) as any);

      expect(mockSvixVerify).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          "svix-id": "test-svix-id",
          "svix-timestamp": "9999999",
          "svix-signature": "v1,abc123",
        }),
      );
    });
  });
});
