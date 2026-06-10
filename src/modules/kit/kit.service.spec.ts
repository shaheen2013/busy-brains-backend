import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { getRepositoryToken } from "@nestjs/typeorm";
import { KitService } from "./kit.service";
import { User } from "../users/entities/user.entity";

const createMockRepository = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  findBy: jest.fn(),
  save: jest.fn(),
  create: jest.fn().mockImplementation((data) => data),
  update: jest.fn(),
  delete: jest.fn(),
  upsert: jest.fn(),
});

const KIT_API_BASE = "https://api.convertkit.com/v3";

const MOCK_KIT_CONFIG = {
  apiKey: "test-api-key",
  signupSequenceId: "seq-signup",
  accountDeletionOtpSequenceId: "seq-account-deletion",
  childDeletionOtpSequenceId: "seq-child-deletion",
  purchaseCompletionSequenceId: "seq-purchase",
};

const mockUser: Partial<User> = {
  id: "user-1",
  name: "Jane Doe",
  email: "jane@example.com",
};

describe("KitService", () => {
  let service: KitService;
  let userRepository: ReturnType<typeof createMockRepository>;
  let mockFetch: jest.Mock;

  const mockConfigService = {
    get: jest.fn().mockReturnValue(MOCK_KIT_CONFIG),
  };

  beforeEach(async () => {
    userRepository = createMockRepository();

    mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue(""),
    });
    global.fetch = mockFetch;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KitService,
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<KitService>(KitService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // subscribeToSignupSequence
  // ---------------------------------------------------------------------------
  describe("subscribeToSignupSequence", () => {
    it("returns early when user not found", async () => {
      userRepository.findOne.mockResolvedValueOnce(null);

      await service.subscribeToSignupSequence("missing-user");

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("returns early when apiKey is missing", async () => {
      userRepository.findOne.mockResolvedValueOnce(mockUser);
      mockConfigService.get.mockReturnValueOnce({
        ...MOCK_KIT_CONFIG,
        apiKey: "",
      });

      await service.subscribeToSignupSequence("user-1");

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("returns early when signupSequenceId is missing", async () => {
      userRepository.findOne.mockResolvedValueOnce(mockUser);
      mockConfigService.get.mockReturnValueOnce({
        ...MOCK_KIT_CONFIG,
        signupSequenceId: "",
      });

      await service.subscribeToSignupSequence("user-1");

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("calls fetch with correct URL and body", async () => {
      userRepository.findOne.mockResolvedValueOnce(mockUser);

      await service.subscribeToSignupSequence("user-1");

      expect(mockFetch).toHaveBeenCalledWith(
        `${KIT_API_BASE}/sequences/${MOCK_KIT_CONFIG.signupSequenceId}/subscribe`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_secret: MOCK_KIT_CONFIG.apiKey,
            email: mockUser.email,
            first_name: mockUser.name,
          }),
        },
      );
    });

    it("throws when fetch response is not ok", async () => {
      userRepository.findOne.mockResolvedValueOnce(mockUser);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        text: jest.fn().mockResolvedValue("Unprocessable Entity"),
      });

      await expect(
        service.subscribeToSignupSequence("user-1"),
      ).rejects.toThrow("Kit API error (422): Unprocessable Entity");
    });
  });

  // ---------------------------------------------------------------------------
  // sendAccountDeletionOtp
  // ---------------------------------------------------------------------------
  describe("sendAccountDeletionOtp", () => {
    it("returns early when user not found", async () => {
      userRepository.findOne.mockResolvedValueOnce(null);

      await service.sendAccountDeletionOtp("missing-user", "123456");

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("returns early when apiKey is missing", async () => {
      userRepository.findOne.mockResolvedValueOnce(mockUser);
      mockConfigService.get.mockReturnValueOnce({
        ...MOCK_KIT_CONFIG,
        apiKey: "",
      });

      await service.sendAccountDeletionOtp("user-1", "123456");

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("returns early when accountDeletionOtpSequenceId is missing", async () => {
      userRepository.findOne.mockResolvedValueOnce(mockUser);
      mockConfigService.get.mockReturnValueOnce({
        ...MOCK_KIT_CONFIG,
        accountDeletionOtpSequenceId: "",
      });

      await service.sendAccountDeletionOtp("user-1", "123456");

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("calls fetch with correct URL and body", async () => {
      userRepository.findOne.mockResolvedValueOnce(mockUser);

      await service.sendAccountDeletionOtp("user-1", "654321");

      expect(mockFetch).toHaveBeenCalledWith(
        `${KIT_API_BASE}/sequences/${MOCK_KIT_CONFIG.accountDeletionOtpSequenceId}/subscribe`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_secret: MOCK_KIT_CONFIG.apiKey,
            email: mockUser.email,
            first_name: mockUser.name,
            fields: { otp: "654321" },
          }),
        },
      );
    });

    it("throws when fetch response is not ok", async () => {
      userRepository.findOne.mockResolvedValueOnce(mockUser);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: jest.fn().mockResolvedValue("Internal Server Error"),
      });

      await expect(
        service.sendAccountDeletionOtp("user-1", "123456"),
      ).rejects.toThrow("Kit API error (500): Internal Server Error");
    });
  });

  // ---------------------------------------------------------------------------
  // sendChildDeletionOtp
  // ---------------------------------------------------------------------------
  describe("sendChildDeletionOtp", () => {
    it("returns early when user not found", async () => {
      userRepository.findOne.mockResolvedValueOnce(null);

      await service.sendChildDeletionOtp("missing-user", "Bob", "000000");

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("returns early when apiKey is missing", async () => {
      userRepository.findOne.mockResolvedValueOnce(mockUser);
      mockConfigService.get.mockReturnValueOnce({
        ...MOCK_KIT_CONFIG,
        apiKey: "",
      });

      await service.sendChildDeletionOtp("user-1", "Bob", "000000");

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("returns early when childDeletionOtpSequenceId is missing", async () => {
      userRepository.findOne.mockResolvedValueOnce(mockUser);
      mockConfigService.get.mockReturnValueOnce({
        ...MOCK_KIT_CONFIG,
        childDeletionOtpSequenceId: "",
      });

      await service.sendChildDeletionOtp("user-1", "Bob", "000000");

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("calls fetch with correct URL and body including child_name", async () => {
      userRepository.findOne.mockResolvedValueOnce(mockUser);

      await service.sendChildDeletionOtp("user-1", "Bob", "112233");

      expect(mockFetch).toHaveBeenCalledWith(
        `${KIT_API_BASE}/sequences/${MOCK_KIT_CONFIG.childDeletionOtpSequenceId}/subscribe`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_secret: MOCK_KIT_CONFIG.apiKey,
            email: mockUser.email,
            first_name: mockUser.name,
            fields: { otp: "112233", child_name: "Bob" },
          }),
        },
      );
    });

    it("throws when fetch response is not ok", async () => {
      userRepository.findOne.mockResolvedValueOnce(mockUser);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: jest.fn().mockResolvedValue("Unauthorized"),
      });

      await expect(
        service.sendChildDeletionOtp("user-1", "Bob", "112233"),
      ).rejects.toThrow("Kit API error (401): Unauthorized");
    });
  });

  // ---------------------------------------------------------------------------
  // subscribeToSequence
  // ---------------------------------------------------------------------------
  describe("subscribeToSequence", () => {
    it("returns early when user not found", async () => {
      userRepository.findOne.mockResolvedValueOnce(null);

      await service.subscribeToSequence("missing-user");

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("returns early when purchaseCompletionSequenceId is missing", async () => {
      userRepository.findOne.mockResolvedValueOnce(mockUser);
      mockConfigService.get.mockReturnValueOnce({
        ...MOCK_KIT_CONFIG,
        purchaseCompletionSequenceId: "",
      });

      await service.subscribeToSequence("user-1");

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("returns early when apiKey is missing", async () => {
      userRepository.findOne.mockResolvedValueOnce(mockUser);
      mockConfigService.get.mockReturnValueOnce({
        ...MOCK_KIT_CONFIG,
        apiKey: "",
      });

      await service.subscribeToSequence("user-1");

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("calls fetch with correct URL and body", async () => {
      userRepository.findOne.mockResolvedValueOnce(mockUser);

      await service.subscribeToSequence("user-1");

      expect(mockFetch).toHaveBeenCalledWith(
        `${KIT_API_BASE}/sequences/${MOCK_KIT_CONFIG.purchaseCompletionSequenceId}/subscribe`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_secret: MOCK_KIT_CONFIG.apiKey,
            email: mockUser.email,
            first_name: mockUser.name,
          }),
        },
      );
    });

    it("throws when fetch response is not ok", async () => {
      userRepository.findOne.mockResolvedValueOnce(mockUser);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: jest.fn().mockResolvedValue("Forbidden"),
      });

      await expect(service.subscribeToSequence("user-1")).rejects.toThrow(
        "Kit API error (403): Forbidden",
      );
    });
  });
});
