import { Test, TestingModule } from "@nestjs/testing";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";
import { User as UserEntity } from "./entities/user.entity";
import { UpdateUserDto } from "./dtos/update-user.dto";
import { UpdatePasswordDto } from "./dtos/update-password.dto";

describe("UsersController", () => {
  let controller: UsersController;
  let usersService: jest.Mocked<UsersService>;

  const mockUser: UserEntity = {
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
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: {
            findWithActivePlan: jest.fn(),
            updateUser: jest.fn(),
            updatePassword: jest.fn(),
            requestDeletion: jest.fn(),
            deleteAccount: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    usersService = module.get(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // GET /users/me
  // ---------------------------------------------------------------------------
  describe("getMe", () => {
    it("should call usersService.findWithActivePlan with the user id", async () => {
      const expectedResult = {
        ...mockUser,
        activePlan: null,
        profileImage: null,
      };
      usersService.findWithActivePlan.mockResolvedValue(expectedResult);

      const result = await controller.getMe(mockUser);

      expect(usersService.findWithActivePlan).toHaveBeenCalledWith("user-1");
      expect(usersService.findWithActivePlan).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedResult);
    });

    it("should return null when service returns null (user not found)", async () => {
      usersService.findWithActivePlan.mockResolvedValue(null);

      const result = await controller.getMe(mockUser);

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // PATCH /users/me
  // ---------------------------------------------------------------------------
  describe("updateMe", () => {
    it("should call usersService.updateUser with userId, dto, and no file", async () => {
      const updateDto: UpdateUserDto = { name: "Updated Name" };
      const updatedUser = { ...mockUser, name: "Updated Name" };
      usersService.updateUser.mockResolvedValue(updatedUser);

      const result = await controller.updateMe(mockUser, updateDto);

      expect(usersService.updateUser).toHaveBeenCalledWith(
        "user-1",
        updateDto,
        undefined,
      );
      expect(result).toEqual(updatedUser);
    });

    it("should pass profile image file to usersService.updateUser when provided", async () => {
      const updateDto: UpdateUserDto = { name: "Updated Name" };
      const mockFile = {
        originalname: "photo.jpg",
        mimetype: "image/jpeg",
      } as Express.Multer.File;
      const updatedUser = { ...mockUser, name: "Updated Name" };
      usersService.updateUser.mockResolvedValue(updatedUser);

      const result = await controller.updateMe(mockUser, updateDto, mockFile);

      expect(usersService.updateUser).toHaveBeenCalledWith(
        "user-1",
        updateDto,
        mockFile,
      );
      expect(result).toEqual(updatedUser);
    });

    it("should return null when service returns null (user not found)", async () => {
      usersService.updateUser.mockResolvedValue(null);

      const result = await controller.updateMe(mockUser, {});

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // PATCH /users/me/password
  // ---------------------------------------------------------------------------
  describe("updatePassword", () => {
    it("should call usersService.updatePassword with userId and dto", async () => {
      const updatePasswordDto: UpdatePasswordDto = {
        currentPassword: "OldPass123",
        newPassword: "NewPass456",
      };
      usersService.updatePassword.mockResolvedValue(undefined);

      const result = await controller.updatePassword(
        mockUser,
        updatePasswordDto,
      );

      expect(usersService.updatePassword).toHaveBeenCalledWith(
        "user-1",
        updatePasswordDto,
      );
      expect(usersService.updatePassword).toHaveBeenCalledTimes(1);
      expect(result).toBeUndefined();
    });

    it("should call usersService.updatePassword without currentPassword for a new password", async () => {
      const updatePasswordDto: UpdatePasswordDto = {
        newPassword: "NewPass456",
      };
      usersService.updatePassword.mockResolvedValue(undefined);

      await controller.updatePassword(mockUser, updatePasswordDto);

      expect(usersService.updatePassword).toHaveBeenCalledWith(
        "user-1",
        updatePasswordDto,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // POST /users/me/request-deletion
  // ---------------------------------------------------------------------------
  describe("requestDeletion", () => {
    it("should call usersService.requestDeletion with the user id", async () => {
      const expectedResponse = { message: "OTP sent to email" };
      usersService.requestDeletion.mockResolvedValue(expectedResponse);

      const result = await controller.requestDeletion(mockUser);

      expect(usersService.requestDeletion).toHaveBeenCalledWith("user-1");
      expect(usersService.requestDeletion).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedResponse);
    });
  });

  // ---------------------------------------------------------------------------
  // DELETE /users/me
  // ---------------------------------------------------------------------------
  describe("deleteAccount", () => {
    it("should call usersService.deleteAccount with userId and otp", async () => {
      const expectedResponse = { message: "Account deleted successfully" };
      usersService.deleteAccount.mockResolvedValue(expectedResponse);

      const result = await controller.deleteAccount(mockUser, "654321");

      expect(usersService.deleteAccount).toHaveBeenCalledWith(
        "user-1",
        "654321",
      );
      expect(usersService.deleteAccount).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedResponse);
    });

    it("should pass the otp string as the second argument", async () => {
      usersService.deleteAccount.mockResolvedValue({
        message: "Account deleted successfully",
      });

      await controller.deleteAccount(mockUser, "112233");

      expect(usersService.deleteAccount).toHaveBeenCalledWith(
        "user-1",
        "112233",
      );
    });
  });
});
