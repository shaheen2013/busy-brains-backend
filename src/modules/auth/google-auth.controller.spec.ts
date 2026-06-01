import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { GoogleAuthController } from "./google-auth.controller";
import { UsersService } from "../users/users.service";
import { PaymentService } from "../payment/payment.service";

// ---------------------------------------------------------------------------
// Mock google-auth-library so we avoid real network calls
// ---------------------------------------------------------------------------
const mockGenerateAuthUrl = jest
  .fn()
  .mockReturnValue("https://accounts.google.com/o/oauth2/auth?mock=1");
const mockGetToken = jest.fn();
const mockSetCredentials = jest.fn();
const mockRequest = jest.fn();

jest.mock("google-auth-library", () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    generateAuthUrl: mockGenerateAuthUrl,
    getToken: mockGetToken,
    setCredentials: mockSetCredentials,
    request: mockRequest,
  })),
}));

// ---------------------------------------------------------------------------
// Mock @clerk/backend so no real Clerk API calls are made
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const createMockResponse = () => ({
  redirect: jest.fn(),
});

const mockConfigValues: Record<string, any> = {
  "google.clientId": "test-client-id",
  "google.clientSecret": "test-client-secret",
  frontendUrl: "http://localhost:3000",
  backendUrl: "http://localhost:3001",
  "clerk.secretKey": "sk_test_clerk_key",
  "features.startTrialOnSignup": false,
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

describe("GoogleAuthController", () => {
  let controller: GoogleAuthController;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Reset config values to defaults
    mockConfigValues["features.startTrialOnSignup"] = false;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GoogleAuthController],
      providers: [
        { provide: ConfigService, useValue: mockConfigService },
        { provide: UsersService, useValue: mockUsersService },
        { provide: PaymentService, useValue: mockPaymentService },
      ],
    }).compile();

    controller = module.get<GoogleAuthController>(GoogleAuthController);
  });

  // -------------------------------------------------------------------------
  // redirectToGoogle
  // -------------------------------------------------------------------------
  describe("redirectToGoogle()", () => {
    it("should redirect to the google auth url", () => {
      const res = createMockResponse();

      controller.redirectToGoogle(res as any);

      expect(res.redirect).toHaveBeenCalledTimes(1);
      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining("accounts.google.com"),
      );
    });

    it("should call generateAuthUrl with offline access_type", () => {
      const res = createMockResponse();

      controller.redirectToGoogle(res as any);

      expect(mockGenerateAuthUrl).toHaveBeenCalledWith(
        expect.objectContaining({ access_type: "offline" }),
      );
    });

    it("should request the email and profile scopes", () => {
      const res = createMockResponse();

      controller.redirectToGoogle(res as any);

      const args = mockGenerateAuthUrl.mock.calls[0][0];
      expect(args.scope).toContain("email");
      expect(args.scope).toContain("profile");
    });
  });

  // -------------------------------------------------------------------------
  // handleCallback – error / missing code
  // -------------------------------------------------------------------------
  describe("handleCallback() – error or missing code", () => {
    it("should redirect to sign-in with google_cancelled error when error param is present", async () => {
      const res = createMockResponse();

      await controller.handleCallback(undefined, "access_denied", res as any);

      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining("error=google_cancelled"),
      );
    });

    it("should redirect to sign-in with google_cancelled error when code is missing", async () => {
      const res = createMockResponse();

      await controller.handleCallback(undefined, undefined, res as any);

      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining("error=google_cancelled"),
      );
    });
  });

  // -------------------------------------------------------------------------
  // handleCallback – existing user flow
  // -------------------------------------------------------------------------
  describe("handleCallback() – existing Clerk user", () => {
    const googleUser = {
      id: "google-id-1",
      email: "existing@example.com",
      name: "Existing User",
      given_name: "Existing",
      family_name: "User",
      picture: "https://example.com/pic.jpg",
    };

    beforeEach(() => {
      mockGetToken.mockResolvedValue({
        tokens: { access_token: "at", id_token: "it" },
      });
      mockSetCredentials.mockReturnValue(undefined);
      mockRequest.mockResolvedValue({ data: googleUser });
      mockGetUserList.mockResolvedValue({
        totalCount: 1,
        data: [{ id: "clerk-existing-id" }],
      });
      mockUsersService.findOrCreateFromOAuth.mockResolvedValue({
        user: { id: "clerk-existing-id" },
        isNew: false,
      });
      mockCreateSignInToken.mockResolvedValue({ token: "sign-in-token-abc" });
    });

    it("should not create a new Clerk user when one already exists", async () => {
      const res = createMockResponse();

      await controller.handleCallback("auth-code", undefined, res as any);

      expect(mockCreateUser).not.toHaveBeenCalled();
    });

    it("should redirect to /google-callback with a token on success", async () => {
      const res = createMockResponse();

      await controller.handleCallback("auth-code", undefined, res as any);

      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining("/google-callback?token=sign-in-token-abc"),
      );
    });

    it("should call findOrCreateFromOAuth with the correct clerk id and email", async () => {
      const res = createMockResponse();

      await controller.handleCallback("auth-code", undefined, res as any);

      expect(mockUsersService.findOrCreateFromOAuth).toHaveBeenCalledWith({
        clerkId: "clerk-existing-id",
        email: googleUser.email,
        name: `${googleUser.given_name} ${googleUser.family_name}`.trim(),
      });
    });

    it("should not start a trial for an existing user", async () => {
      mockConfigValues["features.startTrialOnSignup"] = true;
      const res = createMockResponse();

      await controller.handleCallback("auth-code", undefined, res as any);

      expect(mockPaymentService.startTrial).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // handleCallback – new user flow (startTrialOnSignup = false, default)
  // -------------------------------------------------------------------------
  describe("handleCallback() – new Clerk user", () => {
    const googleUser = {
      id: "google-id-2",
      email: "newuser@example.com",
      name: "New User",
      given_name: "New",
      family_name: "User",
      picture: "https://example.com/pic2.jpg",
    };

    const newDbUser = { id: "clerk-new-id" };

    beforeEach(() => {
      mockGetToken.mockResolvedValue({ tokens: { access_token: "at" } });
      mockSetCredentials.mockReturnValue(undefined);
      mockRequest.mockResolvedValue({ data: googleUser });
      mockGetUserList.mockResolvedValue({ totalCount: 0, data: [] });
      mockCreateUser.mockResolvedValue({ id: "clerk-new-id" });
      mockUsersService.findOrCreateFromOAuth.mockResolvedValue({
        user: newDbUser,
        isNew: true,
      });
      mockCreateSignInToken.mockResolvedValue({ token: "new-token-xyz" });
    });

    it("should create a new Clerk user when none exists", async () => {
      const res = createMockResponse();

      await controller.handleCallback("auth-code", undefined, res as any);

      expect(mockCreateUser).toHaveBeenCalledTimes(1);
      expect(mockCreateUser).toHaveBeenCalledWith(
        expect.objectContaining({ emailAddress: [googleUser.email] }),
      );
    });

    it("should redirect to /google-callback with the new token", async () => {
      const res = createMockResponse();

      await controller.handleCallback("auth-code", undefined, res as any);

      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining("/google-callback?token=new-token-xyz"),
      );
    });

    it("should NOT start trial for new user when startTrialOnSignup is false", async () => {
      const res = createMockResponse();

      await controller.handleCallback("auth-code", undefined, res as any);

      expect(mockPaymentService.startTrial).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // handleCallback – new user flow (startTrialOnSignup = true)
  // These tests need their own module instance because startTrialOnSignup is
  // captured once at construction time via the ConfigService.
  // -------------------------------------------------------------------------
  describe("handleCallback() – new Clerk user (startTrialOnSignup = true)", () => {
    const googleUser = {
      id: "google-id-3",
      email: "trialuser@example.com",
      name: "Trial User",
      given_name: "Trial",
      family_name: "User",
      picture: "",
    };

    const newDbUser = { id: "clerk-trial-id" };
    let trialController: GoogleAuthController;

    beforeEach(async () => {
      jest.clearAllMocks();

      // Build a config service that has startTrialOnSignup = true from the start
      const trialConfigValues: Record<string, any> = {
        "google.clientId": "test-client-id",
        "google.clientSecret": "test-client-secret",
        frontendUrl: "http://localhost:3000",
        backendUrl: "http://localhost:3001",
        "clerk.secretKey": "sk_test_clerk_key",
        "features.startTrialOnSignup": true,
      };
      const trialConfigService = {
        get: jest.fn((key: string) => trialConfigValues[key]),
      };

      const module: TestingModule = await Test.createTestingModule({
        controllers: [GoogleAuthController],
        providers: [
          { provide: ConfigService, useValue: trialConfigService },
          { provide: UsersService, useValue: mockUsersService },
          { provide: PaymentService, useValue: mockPaymentService },
        ],
      }).compile();

      trialController = module.get<GoogleAuthController>(GoogleAuthController);

      mockGetToken.mockResolvedValue({ tokens: { access_token: "at" } });
      mockSetCredentials.mockReturnValue(undefined);
      mockRequest.mockResolvedValue({ data: googleUser });
      mockGetUserList.mockResolvedValue({ totalCount: 0, data: [] });
      mockCreateUser.mockResolvedValue({ id: "clerk-trial-id" });
      mockUsersService.findOrCreateFromOAuth.mockResolvedValue({
        user: newDbUser,
        isNew: true,
      });
      mockCreateSignInToken.mockResolvedValue({ token: "trial-token" });
      mockPaymentService.startTrial.mockResolvedValue(undefined);
    });

    it("should start trial for new user when startTrialOnSignup is true", async () => {
      const res = createMockResponse();

      await trialController.handleCallback("auth-code", undefined, res as any);

      expect(mockPaymentService.startTrial).toHaveBeenCalledWith(newDbUser);
    });

    it("should still redirect successfully even if startTrial throws", async () => {
      mockPaymentService.startTrial.mockRejectedValue(
        new Error("stripe error"),
      );
      const res = createMockResponse();

      await trialController.handleCallback("auth-code", undefined, res as any);

      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining("/google-callback?token="),
      );
    });
  });

  // -------------------------------------------------------------------------
  // handleCallback – unexpected error
  // -------------------------------------------------------------------------
  describe("handleCallback() – unexpected error", () => {
    it("should redirect to sign-in with google_failed when getToken throws", async () => {
      mockGetToken.mockRejectedValue(new Error("token exchange failed"));
      const res = createMockResponse();

      await controller.handleCallback("bad-code", undefined, res as any);

      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining("error=google_failed"),
      );
    });

    it("should redirect to sign-in with google_failed when getUserList throws", async () => {
      mockGetToken.mockResolvedValue({ tokens: {} });
      mockSetCredentials.mockReturnValue(undefined);
      mockRequest.mockResolvedValue({
        data: {
          id: "g1",
          email: "err@example.com",
          name: "Err",
          given_name: "Err",
          family_name: "",
          picture: "",
        },
      });
      mockGetUserList.mockRejectedValue(new Error("clerk error"));
      const res = createMockResponse();

      await controller.handleCallback("some-code", undefined, res as any);

      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining("error=google_failed"),
      );
    });
  });
});
