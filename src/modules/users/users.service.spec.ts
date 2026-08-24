import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

// --- Mock @clerk/backend before any imports that use it ---
const mockVerifyPassword = jest.fn();
const mockUpdateUser = jest.fn();
const mockClerkUsers = {
  verifyPassword: mockVerifyPassword,
  updateUser: mockUpdateUser,
};
const mockClerkClient = { users: mockClerkUsers };
const mockCreateClerkClient = jest.fn().mockReturnValue(mockClerkClient);

jest.mock("@clerk/backend", () => ({
  createClerkClient: (...args: unknown[]) => mockCreateClerkClient(...args),
}));

import { UsersService } from "./users.service";
import { User } from "./entities/user.entity";
import { UserPlan } from "../subscriptions/entities/user-plan.entity";
import { Plan } from "../subscriptions/entities/plan.entity";
import { WeeklySubscription } from "../subscriptions/entities/weekly-subscription.entity";
import { StorageService } from "../storage/storage.service";
import { VerificationService } from "./verification.service";
import { VerificationType } from "./entities/verification-token.entity";
import { KitService } from "../kit/kit.service";

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
  merge: jest.fn().mockImplementation((entity, dto) => ({ ...entity, ...dto })),
});

describe("UsersService", () => {
  let service: UsersService;
  let userRepo: ReturnType<typeof createMockRepository>;
  let userPlanRepo: ReturnType<typeof createMockRepository>;
  let planRepo: ReturnType<typeof createMockRepository>;
  let weeklySubscriptionRepo: ReturnType<typeof createMockRepository>;
  let configService: jest.Mocked<ConfigService>;
  let storageService: jest.Mocked<StorageService>;
  let verificationService: jest.Mocked<VerificationService>;
  let kitService: jest.Mocked<KitService>;

  const mockUser: User = {
    id: "user-1",
    name: "Test User",
    email: "test@example.com",
    phoneNumber: null,
    country: null,
    state: null,
    timezone: null,
    age: null,
    zipcode: null,
    hasPassword: false,
    isDeleted: false,
    stripeCustomerId: null,
    paymentMethodId: null,
    cardBrand: null,
    cardLast4: null,
    cardExpMonth: null,
    cardExpYear: null,
    createdAt: new Date("2024-01-01"),
    children: [],
    userPlans: [],
    payments: [],
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockCreateClerkClient.mockReturnValue(mockClerkClient);

    userRepo = createMockRepository();
    userPlanRepo = createMockRepository();
    planRepo = createMockRepository();
    weeklySubscriptionRepo = createMockRepository();
    weeklySubscriptionRepo.findOne.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: userRepo,
        },
        {
          provide: getRepositoryToken(UserPlan),
          useValue: userPlanRepo,
        },
        {
          provide: getRepositoryToken(Plan),
          useValue: planRepo,
        },
        {
          provide: getRepositoryToken(WeeklySubscription),
          useValue: weeklySubscriptionRepo,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue("test-clerk-secret"),
          },
        },
        {
          provide: StorageService,
          useValue: {
            getResource: jest.fn(),
            upsertProfileImage: jest.fn(),
          },
        },
        {
          provide: VerificationService,
          useValue: {
            generateOtp: jest.fn(),
            verifyOtp: jest.fn(),
          },
        },
        {
          provide: KitService,
          useValue: {
            sendAccountDeletionOtp: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    configService = module.get(ConfigService);
    storageService = module.get(StorageService);
    verificationService = module.get(VerificationService);
    kitService = module.get(KitService);
  });

  // ---------------------------------------------------------------------------
  // findById
  // ---------------------------------------------------------------------------
  describe("findById", () => {
    it("should return the user when found", async () => {
      userRepo.findOne.mockResolvedValue(mockUser);

      const result = await service.findById("user-1");

      expect(userRepo.findOne).toHaveBeenCalledWith({
        where: { id: "user-1" },
      });
      expect(result).toEqual(mockUser);
    });

    it("should return null when user is not found", async () => {
      userRepo.findOne.mockResolvedValue(null);

      const result = await service.findById("nonexistent");

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // findOrCreateFromOAuth
  // ---------------------------------------------------------------------------
  describe("findOrCreateFromOAuth", () => {
    const oauthParams = {
      clerkId: "clerk-123",
      email: "oauth@example.com",
      name: "OAuth User",
    };

    it("should return existing user found by clerkId without creating", async () => {
      userRepo.findOne.mockResolvedValueOnce(mockUser);

      const result = await service.findOrCreateFromOAuth(oauthParams);

      expect(result).toEqual({ user: mockUser, isNew: false });
      // Second findOne (by email) should NOT be called
      expect(userRepo.findOne).toHaveBeenCalledTimes(1);
      expect(userRepo.save).not.toHaveBeenCalled();
    });

    it("should return existing user found by email when no clerkId match", async () => {
      const existingByEmail: User = { ...mockUser, email: oauthParams.email };
      userRepo.findOne
        .mockResolvedValueOnce(null) // no user by clerkId
        .mockResolvedValueOnce(existingByEmail); // found by email

      const result = await service.findOrCreateFromOAuth(oauthParams);

      expect(result).toEqual({ user: existingByEmail, isNew: false });
      expect(userRepo.save).not.toHaveBeenCalled();
    });

    it("should create and return a new user when neither clerkId nor email match", async () => {
      const newUser: User = {
        ...mockUser,
        id: oauthParams.clerkId,
        email: oauthParams.email,
        name: oauthParams.name,
        hasPassword: false,
      };
      userRepo.findOne
        .mockResolvedValueOnce(null) // no user by clerkId
        .mockResolvedValueOnce(null); // no user by email
      userRepo.create.mockImplementation((data) => ({ ...data }));
      userRepo.save.mockResolvedValue(newUser);

      const result = await service.findOrCreateFromOAuth(oauthParams);

      expect(userRepo.create).toHaveBeenCalledWith({
        id: oauthParams.clerkId,
        email: oauthParams.email,
        name: oauthParams.name,
        hasPassword: false,
      });
      expect(userRepo.save).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ user: newUser, isNew: true });
    });
  });

  // ---------------------------------------------------------------------------
  // findWithActivePlan
  // ---------------------------------------------------------------------------
  describe("findWithActivePlan", () => {
    it("should return null when user is not found", async () => {
      userRepo.findOne.mockResolvedValue(null);

      const result = await service.findWithActivePlan("nonexistent");

      expect(result).toBeNull();
    });

    it("should return activePlan type 'none' and profileImage: null when no plan or resource", async () => {
      userRepo.findOne.mockResolvedValue(mockUser);
      userPlanRepo.findOne.mockResolvedValue(null);
      weeklySubscriptionRepo.findOne.mockResolvedValue(null);
      (storageService.getResource as jest.Mock).mockResolvedValue(null);

      const result = await service.findWithActivePlan("user-1");

      expect(result).toEqual({
        ...mockUser,
        activePlan: {
          type: "none",
          id: null,
          userId: null,
          planId: null,
          isTrial: false,
          trialStartedAt: null,
          trialEndsAt: null,
          isActive: false,
          purchasedAt: null,
          createdAt: null,
          plan: null,
          weeklySubscription: null,
          sevenDayExpiredAfterSignup: true,
        },
        profileImage: null,
      });
    });

    it("should return profileImage url from storage when resource has a profile document", async () => {
      userRepo.findOne.mockResolvedValue(mockUser);
      userPlanRepo.findOne.mockResolvedValue(null);
      weeklySubscriptionRepo.findOne.mockResolvedValue(null);
      (storageService.getResource as jest.Mock).mockResolvedValue({
        documents: [
          { label: "profile", url: "https://cdn.example.com/img.jpg" },
        ],
      });

      const result = await service.findWithActivePlan("user-1");

      expect(result).toMatchObject({
        activePlan: { type: "none" },
        profileImage: "https://cdn.example.com/img.jpg",
      });
    });

    it("should return null profileImage when resource has no profile document", async () => {
      userRepo.findOne.mockResolvedValue(mockUser);
      userPlanRepo.findOne.mockResolvedValue(null);
      (storageService.getResource as jest.Mock).mockResolvedValue({
        documents: [
          { label: "other", url: "https://cdn.example.com/other.jpg" },
        ],
      });

      const result = await service.findWithActivePlan("user-1");

      expect(result).toMatchObject({ profileImage: null });
    });

    it("should return TRIAL plan object when userPlan.isTrial is true", async () => {
      const trialEndsAt = new Date("2025-12-31");
      const userPlan = {
        id: "plan-1",
        userId: "user-1",
        isTrial: true,
        trialEndsAt,
        isActive: true,
        plan: null,
      };
      userRepo.findOne.mockResolvedValue(mockUser);
      userPlanRepo.findOne.mockResolvedValue(userPlan);
      (storageService.getResource as jest.Mock).mockResolvedValue(null);

      const result = await service.findWithActivePlan("user-1");

      expect(result).toMatchObject({
        activePlan: {
          ...userPlan,
          plan: { name: "TRIAL", trialEndsAt },
        },
        profileImage: null,
      });
    });

    it("should return the real plan object when userPlan.isTrial is false", async () => {
      const planData = { id: "real-plan", name: "PRO", price: 9.99 };
      const userPlan = {
        id: "plan-1",
        userId: "user-1",
        isTrial: false,
        trialEndsAt: null,
        isActive: true,
        plan: planData,
      };
      userRepo.findOne.mockResolvedValue(mockUser);
      userPlanRepo.findOne.mockResolvedValue(userPlan);
      (storageService.getResource as jest.Mock).mockResolvedValue(null);

      const result = await service.findWithActivePlan("user-1");

      expect(result).toMatchObject({
        activePlan: {
          ...userPlan,
          plan: planData,
        },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // updateUser
  // ---------------------------------------------------------------------------
  describe("updateUser", () => {
    const updateDto = { name: "New Name" };

    it("should return null when user is not found", async () => {
      userRepo.findOne.mockResolvedValue(null);

      const result = await service.updateUser("user-1", updateDto);

      expect(result).toBeNull();
      expect(mockUpdateUser).not.toHaveBeenCalled();
    });

    it("should call clerkClient.users.updateUser and save the user when secretKey is present", async () => {
      userRepo.findOne.mockResolvedValue(mockUser);
      mockUpdateUser.mockResolvedValue({});
      const savedUser = { ...mockUser, name: "New Name" };
      userRepo.save.mockResolvedValue(savedUser);
      (configService.get as jest.Mock).mockReturnValue("test-secret");

      const result = await service.updateUser("user-1", updateDto);

      expect(mockCreateClerkClient).toHaveBeenCalledWith({
        secretKey: "test-secret",
      });
      expect(mockUpdateUser).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({ firstName: "New Name" }),
      );
      expect(userRepo.save).toHaveBeenCalledTimes(1);
      expect(result).toEqual(savedUser);
    });

    it("should skip clerkClient call when secretKey is absent", async () => {
      (configService.get as jest.Mock).mockReturnValue(undefined);
      userRepo.findOne.mockResolvedValue(mockUser);
      const savedUser = { ...mockUser, name: "New Name" };
      userRepo.save.mockResolvedValue(savedUser);

      const result = await service.updateUser("user-1", updateDto);

      expect(mockUpdateUser).not.toHaveBeenCalled();
      expect(userRepo.save).toHaveBeenCalledTimes(1);
      expect(result).toEqual(savedUser);
    });

    it("should call storageService.upsertProfileImage when profileImage is provided", async () => {
      userRepo.findOne.mockResolvedValue(mockUser);
      mockUpdateUser.mockResolvedValue({});
      userRepo.save.mockResolvedValue(mockUser);
      (storageService.upsertProfileImage as jest.Mock).mockResolvedValue({});

      const fakeFile = { originalname: "avatar.jpg" } as Express.Multer.File;
      await service.updateUser("user-1", updateDto, fakeFile);

      expect(storageService.upsertProfileImage).toHaveBeenCalledWith(
        "user",
        "user-1",
        fakeFile,
      );
    });

    it("should NOT call storageService.upsertProfileImage when profileImage is omitted", async () => {
      userRepo.findOne.mockResolvedValue(mockUser);
      mockUpdateUser.mockResolvedValue({});
      userRepo.save.mockResolvedValue(mockUser);

      await service.updateUser("user-1", updateDto);

      expect(storageService.upsertProfileImage).not.toHaveBeenCalled();
    });

    it("should rethrow errors thrown by clerkClient.users.updateUser", async () => {
      userRepo.findOne.mockResolvedValue(mockUser);
      const clerkError = new Error("Clerk failure");
      mockUpdateUser.mockRejectedValue(clerkError);
      (configService.get as jest.Mock).mockReturnValue("test-secret");

      await expect(service.updateUser("user-1", updateDto)).rejects.toThrow(
        clerkError,
      );
    });

    it("should use user.name as fallback when updateDto.name is undefined", async () => {
      userRepo.findOne.mockResolvedValue(mockUser);
      mockUpdateUser.mockResolvedValue({});
      userRepo.save.mockResolvedValue(mockUser);
      (configService.get as jest.Mock).mockReturnValue("test-secret");

      await service.updateUser("user-1", {});

      expect(mockUpdateUser).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({ firstName: mockUser.name }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // updatePassword
  // ---------------------------------------------------------------------------
  describe("updatePassword", () => {
    it("should throw BadRequestException('User not found') when user does not exist", async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updatePassword("user-1", { newPassword: "NewPass123" }),
      ).rejects.toThrow(new BadRequestException("User not found"));
    });

    it("should throw BadRequestException when hasPassword is true but currentPassword is missing", async () => {
      userRepo.findOne.mockResolvedValue({ ...mockUser, hasPassword: true });

      await expect(
        service.updatePassword("user-1", { newPassword: "NewPass123" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException('Password update is not available') when secretKey is missing", async () => {
      userRepo.findOne.mockResolvedValue({ ...mockUser, hasPassword: false });
      (configService.get as jest.Mock).mockReturnValue(undefined);

      await expect(
        service.updatePassword("user-1", { newPassword: "NewPass123" }),
      ).rejects.toThrow(
        new BadRequestException("Password update is not available"),
      );
    });

    it("should throw BadRequestException when verifyPassword returns verified: false", async () => {
      const userWithPassword: User = { ...mockUser, hasPassword: true };
      userRepo.findOne.mockResolvedValue(userWithPassword);
      (configService.get as jest.Mock).mockReturnValue("test-secret");
      mockVerifyPassword.mockResolvedValue({ verified: false });

      await expect(
        service.updatePassword("user-1", {
          currentPassword: "WrongPass",
          newPassword: "NewPass123",
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockVerifyPassword).toHaveBeenCalledWith({
        userId: "user-1",
        password: "WrongPass",
      });
    });

    it("should throw BadRequestException when verifyPassword throws a non-BadRequestException error", async () => {
      const userWithPassword: User = { ...mockUser, hasPassword: true };
      userRepo.findOne.mockResolvedValue(userWithPassword);
      (configService.get as jest.Mock).mockReturnValue("test-secret");
      mockVerifyPassword.mockRejectedValue(new Error("clerk network error"));

      await expect(
        service.updatePassword("user-1", {
          currentPassword: "SomePass",
          newPassword: "NewPass123",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("should rethrow BadRequestException thrown inside verifyPassword block", async () => {
      const userWithPassword: User = { ...mockUser, hasPassword: true };
      userRepo.findOne.mockResolvedValue(userWithPassword);
      (configService.get as jest.Mock).mockReturnValue("test-secret");
      const existingBadRequest = new BadRequestException({
        message: "Current password is incorrect",
        field: "currentPassword",
      });
      mockVerifyPassword.mockRejectedValue(existingBadRequest);

      await expect(
        service.updatePassword("user-1", {
          currentPassword: "SomePass",
          newPassword: "NewPass123",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("should update password and set hasPassword: true when user had no password", async () => {
      const userWithoutPassword: User = { ...mockUser, hasPassword: false };
      userRepo.findOne.mockResolvedValue(userWithoutPassword);
      (configService.get as jest.Mock).mockReturnValue("test-secret");
      mockUpdateUser.mockResolvedValue({});
      userRepo.update.mockResolvedValue({});

      await service.updatePassword("user-1", { newPassword: "NewPass123" });

      expect(mockUpdateUser).toHaveBeenCalledWith("user-1", {
        password: "NewPass123",
      });
      expect(userRepo.update).toHaveBeenCalledWith("user-1", {
        hasPassword: true,
      });
    });

    it("should update password and NOT call userRepo.update when user already had a password", async () => {
      const userWithPassword: User = { ...mockUser, hasPassword: true };
      userRepo.findOne.mockResolvedValue(userWithPassword);
      (configService.get as jest.Mock).mockReturnValue("test-secret");
      mockVerifyPassword.mockResolvedValue({ verified: true });
      mockUpdateUser.mockResolvedValue({});

      await service.updatePassword("user-1", {
        currentPassword: "CorrectPass",
        newPassword: "NewPass123",
      });

      expect(mockUpdateUser).toHaveBeenCalledWith("user-1", {
        password: "NewPass123",
      });
      expect(userRepo.update).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException when clerkClient.users.updateUser fails", async () => {
      const userWithoutPassword: User = { ...mockUser, hasPassword: false };
      userRepo.findOne.mockResolvedValue(userWithoutPassword);
      (configService.get as jest.Mock).mockReturnValue("test-secret");
      mockUpdateUser.mockRejectedValue(new Error("clerk update error"));

      await expect(
        service.updatePassword("user-1", { newPassword: "NewPass123" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("should skip verifyPassword when user.hasPassword is false", async () => {
      const userWithoutPassword: User = { ...mockUser, hasPassword: false };
      userRepo.findOne.mockResolvedValue(userWithoutPassword);
      (configService.get as jest.Mock).mockReturnValue("test-secret");
      mockUpdateUser.mockResolvedValue({});
      userRepo.update.mockResolvedValue({});

      await service.updatePassword("user-1", { newPassword: "NewPass123" });

      expect(mockVerifyPassword).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // requestDeletion
  // ---------------------------------------------------------------------------
  describe("requestDeletion", () => {
    it("should throw NotFoundException when user is not found", async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.requestDeletion("nonexistent")).rejects.toThrow(
        new NotFoundException("User not found"),
      );

      expect(verificationService.generateOtp).not.toHaveBeenCalled();
    });

    it("should generate OTP, send it via kit, and return success message", async () => {
      userRepo.findOne.mockResolvedValue(mockUser);
      (verificationService.generateOtp as jest.Mock).mockResolvedValue(
        "654321",
      );
      (kitService.sendAccountDeletionOtp as jest.Mock).mockResolvedValue(
        undefined,
      );

      const result = await service.requestDeletion("user-1");

      expect(verificationService.generateOtp).toHaveBeenCalledWith(
        "user-1",
        VerificationType.ACCOUNT_DELETION,
      );
      expect(kitService.sendAccountDeletionOtp).toHaveBeenCalledWith(
        "user-1",
        "654321",
      );
      expect(result).toEqual({ message: "OTP sent to email" });
    });
  });

  // ---------------------------------------------------------------------------
  // deleteAccount
  // ---------------------------------------------------------------------------
  describe("deleteAccount", () => {
    it("should verify OTP, mark user as deleted, and return success message", async () => {
      (verificationService.verifyOtp as jest.Mock).mockResolvedValue(true);
      userRepo.update.mockResolvedValue({});

      const result = await service.deleteAccount("user-1", "123456");

      expect(verificationService.verifyOtp).toHaveBeenCalledWith(
        "user-1",
        VerificationType.ACCOUNT_DELETION,
        "123456",
      );
      expect(userRepo.update).toHaveBeenCalledWith("user-1", {
        isDeleted: true,
      });
      expect(result).toEqual({ message: "Account deleted successfully" });
    });

    it("should propagate exceptions thrown by verificationService.verifyOtp", async () => {
      const error = new BadRequestException("Invalid OTP");
      (verificationService.verifyOtp as jest.Mock).mockRejectedValue(error);

      await expect(
        service.deleteAccount("user-1", "wrong-otp"),
      ).rejects.toThrow(error);

      expect(userRepo.update).not.toHaveBeenCalled();
    });
  });
});
