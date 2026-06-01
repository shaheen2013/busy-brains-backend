import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { UnauthorizedException } from "@nestjs/common";
import { AuthService } from "./auth.service";

// jest.mock is hoisted before variable declarations. We keep all mock state
// inside the factory so there are no TDZ issues.
jest.mock("@clerk/backend", () => {
  const mockVerifyTokenFn = jest.fn();
  const mockClientInstance: Record<string, unknown> = {};
  const mockCreateClerkClientFn = jest.fn().mockReturnValue(mockClientInstance);

  return {
    __esModule: true,
    createClerkClient: mockCreateClerkClientFn,
    // Delegate to the inner jest.fn so tests can control resolved values
    verifyToken: (...args: unknown[]) => mockVerifyTokenFn(...args),
    // Expose internals for tests to read/configure
    __mockVerifyToken: mockVerifyTokenFn,
    __mockCreateClerkClient: mockCreateClerkClientFn,
    __mockClientInstance: mockClientInstance,
  };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const clerkBackend = require("@clerk/backend") as {
  createClerkClient: jest.Mock;
  __mockVerifyToken: jest.Mock;
  __mockCreateClerkClient: jest.Mock;
  __mockClientInstance: Record<string, unknown>;
};

describe("AuthService", () => {
  let service: AuthService;
  let configService: jest.Mocked<Pick<ConfigService, "get">>;

  const buildModule = async (
    secretKeyValue: string | undefined = "test-secret-key",
  ): Promise<void> => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(secretKeyValue),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    configService = module.get(ConfigService);
  };

  beforeEach(async () => {
    clerkBackend.__mockVerifyToken.mockReset();
    clerkBackend.__mockCreateClerkClient.mockReset();
    clerkBackend.__mockCreateClerkClient.mockReturnValue(
      clerkBackend.__mockClientInstance,
    );
    await buildModule();
  });

  // -------------------------------------------------------------------------
  // Constructor
  // -------------------------------------------------------------------------

  describe("constructor", () => {
    it("should throw when CLERK_SECRET_KEY is missing", async () => {
      const builder = Test.createTestingModule({
        providers: [
          AuthService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockReturnValue(undefined),
            },
          },
        ],
      });

      await expect(builder.compile()).rejects.toThrow(
        "CLERK_SECRET_KEY is missing",
      );
    });

    it("should call createClerkClient with the configured secret key", () => {
      expect(clerkBackend.__mockCreateClerkClient).toHaveBeenCalledWith({
        secretKey: "test-secret-key",
      });
    });
  });

  // -------------------------------------------------------------------------
  // verifyToken
  // -------------------------------------------------------------------------

  describe("verifyToken", () => {
    it("should return the JWT payload when clerkVerifyToken resolves successfully", async () => {
      const mockPayload = { sub: "user_123", email: "test@example.com" };
      clerkBackend.__mockVerifyToken.mockResolvedValueOnce(mockPayload);

      const result = await service.verifyToken("valid-token");

      expect(clerkBackend.__mockVerifyToken).toHaveBeenCalledWith(
        "valid-token",
        {
          secretKey: "test-secret-key",
        },
      );
      expect(result).toEqual(mockPayload);
    });

    it("should throw UnauthorizedException('Invalid token') when clerkVerifyToken rejects", async () => {
      clerkBackend.__mockVerifyToken.mockRejectedValueOnce(
        new Error("Token expired"),
      );

      await expect(service.verifyToken("expired-token")).rejects.toThrow(
        new UnauthorizedException("Invalid token"),
      );
    });

    it("should throw UnauthorizedException('Invalid token') when the secret key is missing at call time", async () => {
      // The catch block wraps any thrown error (including the UnauthorizedException
      // for missing key) and re-throws as "Invalid token".
      (configService.get as jest.Mock).mockReturnValue(undefined);

      await expect(service.verifyToken("some-token")).rejects.toThrow(
        new UnauthorizedException("Invalid token"),
      );

      // clerkVerifyToken must NOT have been called
      expect(clerkBackend.__mockVerifyToken).not.toHaveBeenCalled();
    });

    it("should always produce 'Invalid token' message regardless of the underlying error type", async () => {
      clerkBackend.__mockVerifyToken.mockRejectedValueOnce(
        new UnauthorizedException("Some internal clerk error"),
      );

      await expect(service.verifyToken("bad-token")).rejects.toMatchObject({
        message: "Invalid token",
      });
    });
  });

  // -------------------------------------------------------------------------
  // getClerkClient
  // -------------------------------------------------------------------------

  describe("getClerkClient", () => {
    it("should return the clerk client instance that was created in the constructor", () => {
      const client = service.getClerkClient();
      expect(client).toBe(clerkBackend.__mockClientInstance);
    });
  });
});
