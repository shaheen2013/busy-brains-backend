import { Test, TestingModule } from "@nestjs/testing";
import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ClerkGuard } from "./clerk.guard";
import { AuthService } from "../auth.service";
import { UsersService } from "../../users/users.service";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { User } from "../../users/entities/user.entity";
import { ClerkJwtPayload } from "../../../types/clerk-Jwt-Payload";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockExecutionContext(options: {
  isPublic?: boolean;
  authorizationHeader?: string;
}): ExecutionContext {
  const { authorizationHeader } = options;

  const mockRequest = {
    headers: {
      ...(authorizationHeader !== undefined
        ? { authorization: authorizationHeader }
        : {}),
    },
    user: undefined as unknown,
  };

  const mockHandler = jest.fn();
  const mockClass = jest.fn();

  const context: ExecutionContext = {
    getHandler: jest.fn().mockReturnValue(mockHandler),
    getClass: jest.fn().mockReturnValue(mockClass),
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue(mockRequest),
    }),
    // Not used in ClerkGuard but required by the CanActivate interface
    getType: jest.fn(),
    getArgs: jest.fn(),
    getArgByIndex: jest.fn(),
    switchToRpc: jest.fn(),
    switchToWs: jest.fn(),
  };

  return context;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ClerkGuard", () => {
  let guard: ClerkGuard;
  let authService: jest.Mocked<Pick<AuthService, "verifyToken">>;
  let usersService: jest.Mocked<Pick<UsersService, "findById">>;
  let reflector: jest.Mocked<Reflector>;

  const mockPayload: ClerkJwtPayload = { sub: "user_abc123" };

  const mockUser: Partial<User> = {
    id: "user_abc123",
    email: "test@example.com",
    name: "Test User",
    isDeleted: false,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClerkGuard,
        {
          provide: AuthService,
          useValue: {
            verifyToken: jest.fn(),
          },
        },
        {
          provide: UsersService,
          useValue: {
            findById: jest.fn(),
          },
        },
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<ClerkGuard>(ClerkGuard);
    authService = module.get(AuthService);
    usersService = module.get(UsersService);
    reflector = module.get(Reflector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Public route
  // -------------------------------------------------------------------------

  describe("when the endpoint is decorated with @Public()", () => {
    it("should return true without verifying any token", async () => {
      reflector.getAllAndOverride.mockReturnValue(true);

      const context = createMockExecutionContext({});
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(authService.verifyToken).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Missing / malformed Authorization header
  // -------------------------------------------------------------------------

  describe("when the Authorization header is absent", () => {
    it("should throw UnauthorizedException('Missing authorization token')", async () => {
      reflector.getAllAndOverride.mockReturnValue(false);

      const context = createMockExecutionContext({});

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException("Missing authorization token"),
      );
      expect(authService.verifyToken).not.toHaveBeenCalled();
    });
  });

  describe("when the Authorization header is not a Bearer token", () => {
    it("should throw UnauthorizedException('Missing authorization token') for Basic scheme", async () => {
      reflector.getAllAndOverride.mockReturnValue(false);

      const context = createMockExecutionContext({
        authorizationHeader: "Basic dXNlcjpwYXNz",
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException("Missing authorization token"),
      );
      expect(authService.verifyToken).not.toHaveBeenCalled();
    });

    it("should throw UnauthorizedException('Missing authorization token') for a token without a scheme", async () => {
      reflector.getAllAndOverride.mockReturnValue(false);

      const context = createMockExecutionContext({
        authorizationHeader: "some-token-without-scheme",
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException("Missing authorization token"),
      );
    });
  });

  // -------------------------------------------------------------------------
  // User not found in DB
  // -------------------------------------------------------------------------

  describe("when the token is valid but the user is not in the database", () => {
    it("should throw UnauthorizedException('User not found')", async () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      (authService.verifyToken as jest.Mock).mockResolvedValue(mockPayload);
      (usersService.findById as jest.Mock).mockResolvedValue(null);

      const context = createMockExecutionContext({
        authorizationHeader: "Bearer valid-jwt",
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException("User not found"),
      );
      expect(authService.verifyToken).toHaveBeenCalledWith("valid-jwt");
      expect(usersService.findById).toHaveBeenCalledWith(mockPayload.sub);
    });
  });

  // -------------------------------------------------------------------------
  // Deleted user
  // -------------------------------------------------------------------------

  describe("when the user account has been deleted", () => {
    it("should throw UnauthorizedException('The account is deleted!')", async () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      (authService.verifyToken as jest.Mock).mockResolvedValue(mockPayload);
      (usersService.findById as jest.Mock).mockResolvedValue({
        ...mockUser,
        isDeleted: true,
      });

      const context = createMockExecutionContext({
        authorizationHeader: "Bearer valid-jwt",
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        new UnauthorizedException("The account is deleted!"),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Happy path
  // -------------------------------------------------------------------------

  describe("when the token is valid and the user exists and is active", () => {
    it("should return true and attach the user to the request object", async () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      (authService.verifyToken as jest.Mock).mockResolvedValue(mockPayload);
      (usersService.findById as jest.Mock).mockResolvedValue(mockUser);

      const context = createMockExecutionContext({
        authorizationHeader: "Bearer valid-jwt",
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);

      // Verify user was attached to the request
      const request = context
        .switchToHttp()
        .getRequest<Record<string, unknown>>();
      expect(request.user).toEqual(mockUser);
    });

    it("should call reflector with IS_PUBLIC_KEY and both handler and class targets", async () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      (authService.verifyToken as jest.Mock).mockResolvedValue(mockPayload);
      (usersService.findById as jest.Mock).mockResolvedValue(mockUser);

      const context = createMockExecutionContext({
        authorizationHeader: "Bearer valid-jwt",
      });

      await guard.canActivate(context);

      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
    });
  });
});
