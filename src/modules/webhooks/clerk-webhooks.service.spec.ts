import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ClerkWebhooksService } from "./clerk-webhooks.service";
import { User } from "../users/entities/user.entity";
import { PaymentService } from "../payment/payment.service";
import { KitService } from "../kit/kit.service";

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

// ---------------------------------------------------------------------------
// Helpers to build Clerk event payloads
// ---------------------------------------------------------------------------
const buildClerkPayload = (overrides: Record<string, any> = {}) => ({
  id: "clerk-user-1",
  first_name: "Jane",
  last_name: "Doe",
  email_addresses: [{ id: "email-1", email_address: "jane@example.com" }],
  primary_email_address_id: "email-1",
  phone_numbers: [{ phone_number: "+1234567890" }],
  password_enabled: false,
  sign_in_methods: [],
  ...overrides,
});

const buildClerkEvent = (
  type: string,
  dataOverrides: Record<string, any> = {},
) => ({
  type,
  data: buildClerkPayload(dataOverrides),
});

describe("ClerkWebhooksService", () => {
  let service: ClerkWebhooksService;
  let userRepository: ReturnType<typeof createMockRepository>;
  let paymentService: { startTrial: jest.Mock };
  let mockConfigService: { get: jest.Mock };
  let kitService: { subscribeToSignupSequence: jest.Mock };

  beforeEach(async () => {
    userRepository = createMockRepository();
    paymentService = { startTrial: jest.fn().mockResolvedValue(undefined) };
    mockConfigService = { get: jest.fn().mockReturnValue(false) };
    kitService = {
      subscribeToSignupSequence: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClerkWebhooksService,
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: PaymentService, useValue: paymentService },
        { provide: KitService, useValue: kitService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<ClerkWebhooksService>(ClerkWebhooksService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // handleUserCreated
  // ---------------------------------------------------------------------------
  describe("handleUserCreated", () => {
    it("upserts user with mapped fields", async () => {
      const event = buildClerkEvent("user.created");

      await service.handleUserCreated(event);

      expect(userRepository.upsert).toHaveBeenCalledWith(
        {
          id: "clerk-user-1",
          name: "Jane Doe",
          email: "jane@example.com",
          phoneNumber: "+1234567890",
          hasPassword: false,
        },
        ["id"],
      );
    });

    it("starts trial when features.startTrialOnSignup is true", async () => {
      mockConfigService.get.mockReturnValueOnce(true);
      const savedUser: Partial<User> = {
        id: "clerk-user-1",
        email: "jane@example.com",
      };
      userRepository.findOne.mockResolvedValueOnce(savedUser);

      const event = buildClerkEvent("user.created");

      await service.handleUserCreated(event);

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: "clerk-user-1" },
      });
      expect(paymentService.startTrial).toHaveBeenCalledWith(savedUser);
    });

    it("does not start trial when features.startTrialOnSignup is false", async () => {
      mockConfigService.get.mockReturnValueOnce(false);

      const event = buildClerkEvent("user.created");

      await service.handleUserCreated(event);

      expect(paymentService.startTrial).not.toHaveBeenCalled();
    });

    it("does not start trial when user not found after upsert", async () => {
      mockConfigService.get.mockReturnValueOnce(true);
      userRepository.findOne.mockResolvedValueOnce(null);

      const event = buildClerkEvent("user.created");

      await service.handleUserCreated(event);

      expect(paymentService.startTrial).not.toHaveBeenCalled();
    });

    it("does not throw when startTrial rejects — logs error instead", async () => {
      mockConfigService.get.mockReturnValueOnce(true);
      const savedUser: Partial<User> = {
        id: "clerk-user-1",
        email: "jane@example.com",
      };
      userRepository.findOne.mockResolvedValueOnce(savedUser);
      paymentService.startTrial.mockRejectedValueOnce(
        new Error("User already has an active plan or trial"),
      );

      const event = buildClerkEvent("user.created");

      await expect(
        service.handleUserCreated(event as any),
      ).resolves.not.toThrow();
    });

    it("returns early (skips upsert) when no email in payload", async () => {
      const event = buildClerkEvent("user.created", {
        email_addresses: [],
        primary_email_address_id: null,
      });

      await service.handleUserCreated(event);

      expect(userRepository.upsert).not.toHaveBeenCalled();
      expect(paymentService.startTrial).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // handleUserUpdated
  // ---------------------------------------------------------------------------
  describe("handleUserUpdated", () => {
    it("calls update with name, email, and hasPassword only", async () => {
      const event = buildClerkEvent("user.updated", {
        password_enabled: true,
      });

      await service.handleUserUpdated(event);

      expect(userRepository.update).toHaveBeenCalledWith(
        { id: "clerk-user-1" },
        { name: "Jane Doe", email: "jane@example.com", hasPassword: true },
      );
    });

    it("returns early when no email in payload", async () => {
      const event = buildClerkEvent("user.updated", {
        email_addresses: [],
        primary_email_address_id: null,
      });

      await service.handleUserUpdated(event);

      expect(userRepository.update).not.toHaveBeenCalled();
    });

    it("uses email prefix as name when first_name and last_name are both null", async () => {
      const event = buildClerkEvent("user.updated", {
        first_name: null,
        last_name: null,
      });

      await service.handleUserUpdated(event);

      expect(userRepository.update).toHaveBeenCalledWith(
        { id: "clerk-user-1" },
        expect.objectContaining({ name: "jane" }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // handleUserDeleted
  // ---------------------------------------------------------------------------
  describe("handleUserDeleted", () => {
    it("deletes user by id", async () => {
      const event = buildClerkEvent("user.deleted");

      await service.handleUserDeleted(event);

      expect(userRepository.delete).toHaveBeenCalledWith({
        id: "clerk-user-1",
      });
    });
  });

  // ---------------------------------------------------------------------------
  // mapClerkPayloadToUser (tested indirectly via handleUserCreated)
  // ---------------------------------------------------------------------------
  describe("mapClerkPayloadToUser (via handleUserCreated)", () => {
    it("falls back to first email address when primary_email_address_id does not match", async () => {
      const event = buildClerkEvent("user.created", {
        primary_email_address_id: "nonexistent-id",
        email_addresses: [
          { id: "email-2", email_address: "fallback@example.com" },
        ],
      });

      await service.handleUserCreated(event);

      expect(userRepository.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ email: "fallback@example.com" }),
        ["id"],
      );
    });

    it("sets hasPassword true when password_enabled is true", async () => {
      const event = buildClerkEvent("user.created", { password_enabled: true });

      await service.handleUserCreated(event);

      expect(userRepository.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ hasPassword: true }),
        ["id"],
      );
    });

    it("sets hasPassword true when sign_in_methods includes password strategy", async () => {
      const event = buildClerkEvent("user.created", {
        password_enabled: false,
        sign_in_methods: [{ strategy: "password" }],
      });

      await service.handleUserCreated(event);

      expect(userRepository.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ hasPassword: true }),
        ["id"],
      );
    });

    it("sets phoneNumber to null when phone_numbers is empty", async () => {
      const event = buildClerkEvent("user.created", { phone_numbers: [] });

      await service.handleUserCreated(event);

      expect(userRepository.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ phoneNumber: null }),
        ["id"],
      );
    });
  });
});
