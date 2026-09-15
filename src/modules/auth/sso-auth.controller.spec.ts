import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { SsoAuthController } from "./sso-auth.controller";
import { SsoAuthService } from "./sso-auth.service";
import { UsersService } from "../users/users.service";
import { PaymentService } from "../payment/payment.service";
import { KitService } from "../kit/kit.service";

// ---------------------------------------------------------------------------
// Mock @clerk/backend
// ---------------------------------------------------------------------------
const mockGetUserList = jest.fn();
const mockCreateUser = jest.fn();
const mockCreateSignInToken = jest.fn();

jest.mock("@clerk/backend", () => ({
  createClerkClient: jest.fn().mockReturnValue({
    users: {
      getUserList: (...args: any[]) => mockGetUserList(...args),
      createUser: (...args: any[]) => mockCreateUser(...args),
    },
    signInTokens: {
      createSignInToken: (...args: any[]) => mockCreateSignInToken(...args),
    },
  }),
}));

describe("SsoAuthController & SsoAuthService", () => {
  let controller: SsoAuthController;
  let service: SsoAuthService;

  const mockConfigValues: Record<string, any> = {
    frontendUrl: "http://localhost:3000",
    backendUrl: "http://localhost:3001",
    "clerk.secretKey": "sk_test_clerk_key",
    "features.startTrialOnSignup": false,
    "sso.verifyUrl": "https://hr.mediusware.xyz/api/verify_token",
    "sso.mock": false,
    "sso.defaultEmail": "admin@example.com",
    "sso.defaultName": "Admin",
  };

  const mockConfigService = {
    get: jest.fn((key: string) => mockConfigValues[key]),
  };

  const mockUsersService = {
    findOrCreateFromOAuth: jest.fn(),
  };

  const mockPaymentService = {
    startTrial: jest.fn(),
  };

  const mockKitService = {
    subscribeToSignupSequence: jest.fn(),
  };

  const createMockResponse = () => ({
    redirect: jest.fn(),
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    mockConfigValues["sso.mock"] = false;

    // Reset global fetch mock
    (global as any).fetch = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SsoAuthController],
      providers: [
        SsoAuthService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: UsersService, useValue: mockUsersService },
        { provide: PaymentService, useValue: mockPaymentService },
        { provide: KitService, useValue: mockKitService },
      ],
    }).compile();

    controller = module.get<SsoAuthController>(SsoAuthController);
    service = module.get<SsoAuthService>(SsoAuthService);
  });

  describe("SsoAuthController", () => {
    it("should redirect to sign-in error when no token is provided", async () => {
      const res = createMockResponse();
      await controller.handleCallback({}, res as any);

      expect(res.redirect).toHaveBeenCalledWith(
        "http://localhost:3000/sign-in?error=sso_failed",
      );
    });

    it("should redirect to sso-callback with ticket on successful verification", async () => {
      const res = createMockResponse();

      jest.spyOn(service, "verifyAndAuthenticate").mockResolvedValue({
        success: true,
        ticket: "valid-ticket-123",
        user: { email: "admin@example.com", role: "admin" },
      });

      await controller.handleCallback(
        { access_token: "valid-token" },
        res as any,
      );

      expect(service.verifyAndAuthenticate).toHaveBeenCalledWith("valid-token");
      expect(res.redirect).toHaveBeenCalledWith(
        "http://localhost:3000/sso-callback?token=valid-ticket-123",
      );
    });

    it("should redirect to sign-in error when verification fails", async () => {
      const res = createMockResponse();

      jest.spyOn(service, "verifyAndAuthenticate").mockResolvedValue({
        success: false,
        message: "Invalid or expired token",
      });

      await controller.handleCallback(
        { access_token: "invalid-token" },
        res as any,
      );

      expect(res.redirect).toHaveBeenCalledWith(
        "http://localhost:3000/sign-in?error=sso_failed",
      );
    });

    it("should handle alias route /auth/sso/callback identically", async () => {
      const res = createMockResponse();

      jest.spyOn(service, "verifyAndAuthenticate").mockResolvedValue({
        success: true,
        ticket: "alias-ticket-456",
        user: { email: "admin@example.com" },
      });

      await controller.handleSsoCallbackAlias(
        { token: "alias-token" },
        res as any,
      );

      expect(service.verifyAndAuthenticate).toHaveBeenCalledWith("alias-token");
      expect(res.redirect).toHaveBeenCalledWith(
        "http://localhost:3000/sso-callback?token=alias-ticket-456",
      );
    });
  });

  describe("SsoAuthService", () => {
    it("should handle mock SSO mode without making remote HTTP requests", async () => {
      mockConfigValues["sso.mock"] = true;

      // Re-instantiate service with mock config
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SsoAuthService,
          { provide: ConfigService, useValue: mockConfigService },
          { provide: UsersService, useValue: mockUsersService },
          { provide: PaymentService, useValue: mockPaymentService },
          { provide: KitService, useValue: mockKitService },
        ],
      }).compile();

      const mockService = module.get<SsoAuthService>(SsoAuthService);

      mockGetUserList.mockResolvedValue({ totalCount: 0, data: [] });
      mockCreateUser.mockResolvedValue({ id: "clerk_mock_admin" });
      mockUsersService.findOrCreateFromOAuth.mockResolvedValue({
        user: { id: "clerk_mock_admin", email: "admin@example.com" },
        isNew: true,
      });
      mockCreateSignInToken.mockResolvedValue({ token: "mock-clerk-ticket" });

      const result = await mockService.verifyAndAuthenticate();

      expect(result.success).toBe(true);
      expect(result.ticket).toBe("mock-clerk-ticket");
      expect((global as any).fetch).not.toHaveBeenCalled();
    });

    it("should successfully verify remote token and provision user session", async () => {
      (global as any).fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          status: "success",
          message: "Token verified successfully",
          data: {
            user: {
              email: "sso-admin@mediusware.xyz",
              role: "admin",
            },
          },
        }),
      });

      mockGetUserList.mockResolvedValue({
        totalCount: 1,
        data: [{ id: "clerk_existing_sso_user" }],
      });
      mockUsersService.findOrCreateFromOAuth.mockResolvedValue({
        user: {
          id: "clerk_existing_sso_user",
          email: "sso-admin@mediusware.xyz",
        },
        isNew: false,
      });
      mockCreateSignInToken.mockResolvedValue({
        token: "real-clerk-ticket-789",
      });

      const result = await service.verifyAndAuthenticate("valid-sso-hash");

      expect((global as any).fetch).toHaveBeenCalledWith(
        "https://hr.mediusware.xyz/api/verify_token",
        expect.objectContaining({
          method: "POST",
          headers: {
            Authorization: "Bearer valid-sso-hash",
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            token: "valid-sso-hash",
            access_token: "valid-sso-hash",
          }),
        }),
      );

      expect(result.success).toBe(true);
      expect(result.ticket).toBe("real-clerk-ticket-789");
      expect(result.user?.email).toBe("sso-admin@mediusware.xyz");
    });

    it("should return failure when remote verification returns error", async () => {
      (global as any).fetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({
          success: false,
          status: "error",
          message: "Invalid or expired token",
        }),
      });

      const result = await service.verifyAndAuthenticate("expired-token");

      expect(result.success).toBe(false);
      expect(result.message).toBe("Invalid or expired token");
    });

    it("should handle remote verification network exceptions gracefully", async () => {
      (global as any).fetch.mockRejectedValue(new Error("Connection timeout"));

      const result = await service.verifyAndAuthenticate("some-token");

      expect(result.success).toBe(false);
      expect(result.message).toBe(
        "Verification service temporarily unavailable",
      );
    });
  });
});
