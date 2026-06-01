import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { BadRequestException } from "@nestjs/common";
import { VerificationService } from "./verification.service";
import {
  VerificationToken,
  VerificationType,
} from "./entities/verification-token.entity";

jest.mock("bcrypt", () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

import bcrypt from "bcrypt";

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

describe("VerificationService", () => {
  let service: VerificationService;
  let repo: ReturnType<typeof createMockRepository>;

  beforeEach(async () => {
    jest.clearAllMocks();
    repo = createMockRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VerificationService,
        {
          provide: getRepositoryToken(VerificationToken),
          useValue: repo,
        },
      ],
    }).compile();

    service = module.get<VerificationService>(VerificationService);
  });

  describe("generateOtp", () => {
    it("should generate a 6-digit OTP string, save a token, and return the OTP", async () => {
      const mockOtpHash = "hashed-otp";
      (bcrypt.hash as jest.Mock).mockResolvedValue(mockOtpHash);
      repo.save.mockResolvedValue({});

      const result = await service.generateOtp(
        "user-1",
        VerificationType.ACCOUNT_DELETION,
      );

      // Must be a string of exactly 6 digits
      expect(typeof result).toBe("string");
      expect(result).toMatch(/^\d{6}$/);

      // bcrypt.hash called with the otp and salt rounds 10
      expect(bcrypt.hash).toHaveBeenCalledWith(result, 10);

      // repo.create called with the right shape
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          type: VerificationType.ACCOUNT_DELETION,
          otpHash: mockOtpHash,
          expiresAt: expect.any(Date),
        }),
      );

      // expiry is approximately 10 minutes in the future
      const createdCall = repo.create.mock.calls[0][0];
      const expiresAt: Date = createdCall.expiresAt;
      const diff = expiresAt.getTime() - Date.now();
      expect(diff).toBeGreaterThan(9 * 60 * 1000); // at least 9 min
      expect(diff).toBeLessThanOrEqual(10 * 60 * 1000 + 500); // at most 10 min + buffer

      // token must be saved
      expect(repo.save).toHaveBeenCalledTimes(1);
    });

    it("should work with CHILD_DELETION type as well", async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue("child-hash");
      repo.save.mockResolvedValue({});

      const result = await service.generateOtp(
        "user-2",
        VerificationType.CHILD_DELETION,
      );

      expect(result).toMatch(/^\d{6}$/);
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-2",
          type: VerificationType.CHILD_DELETION,
        }),
      );
    });
  });

  describe("verifyOtp", () => {
    it("should throw BadRequestException('No OTP found') when no token exists", async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.verifyOtp(
          "user-1",
          VerificationType.ACCOUNT_DELETION,
          "123456",
        ),
      ).rejects.toThrow(new BadRequestException("No OTP found"));

      expect(repo.findOne).toHaveBeenCalledWith({
        where: {
          userId: "user-1",
          type: VerificationType.ACCOUNT_DELETION,
          isUsed: false,
        },
        order: { createdAt: "DESC" },
      });
    });

    it("should throw BadRequestException('OTP expired') when token.expiresAt is in the past", async () => {
      const expiredToken: Partial<VerificationToken> = {
        id: "token-id",
        userId: "user-1",
        type: VerificationType.ACCOUNT_DELETION,
        otpHash: "some-hash",
        expiresAt: new Date(Date.now() - 1000), // 1 second in the past
        isUsed: false,
      };
      repo.findOne.mockResolvedValue(expiredToken);

      await expect(
        service.verifyOtp(
          "user-1",
          VerificationType.ACCOUNT_DELETION,
          "123456",
        ),
      ).rejects.toThrow(new BadRequestException("OTP expired"));

      // bcrypt.compare should not be called for expired tokens
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException('Invalid OTP') when bcrypt.compare returns false", async () => {
      const validToken: Partial<VerificationToken> = {
        id: "token-id",
        userId: "user-1",
        type: VerificationType.ACCOUNT_DELETION,
        otpHash: "correct-hash",
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes in the future
        isUsed: false,
      };
      repo.findOne.mockResolvedValue(validToken);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.verifyOtp(
          "user-1",
          VerificationType.ACCOUNT_DELETION,
          "wrong-otp",
        ),
      ).rejects.toThrow(new BadRequestException("Invalid OTP"));

      expect(bcrypt.compare).toHaveBeenCalledWith("wrong-otp", "correct-hash");
      // token should NOT be marked as used
      expect(repo.save).not.toHaveBeenCalled();
    });

    it("should return true and mark token as used on success", async () => {
      const validToken: Partial<VerificationToken> = {
        id: "token-id",
        userId: "user-1",
        type: VerificationType.ACCOUNT_DELETION,
        otpHash: "correct-hash",
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        isUsed: false,
      };
      repo.findOne.mockResolvedValue(validToken);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      repo.save.mockResolvedValue({ ...validToken, isUsed: true });

      const result = await service.verifyOtp(
        "user-1",
        VerificationType.ACCOUNT_DELETION,
        "correct-otp",
      );

      expect(result).toBe(true);
      expect(bcrypt.compare).toHaveBeenCalledWith(
        "correct-otp",
        "correct-hash",
      );
      expect(validToken.isUsed).toBe(true);
      expect(repo.save).toHaveBeenCalledWith(validToken);
    });
  });
});
