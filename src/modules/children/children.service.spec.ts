import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { In } from "typeorm";
import { ChildrenService } from "./children.service";
import { Child } from "./entities/child.entity";
import { ChildModule } from "./entities/child-module.entity";
import { ChildQuest } from "./entities/child-quest.entity";
import { ChildScreen } from "./entities/child-screen.entity";
import { UserPlan } from "../subscriptions/entities/user-plan.entity";
import { User } from "../users/entities/user.entity";
import { S3Service } from "../storage/s3.service";
import { KitService } from "../kit/kit.service";
import { VerificationService } from "../users/verification.service";
import { VerificationType } from "../users/entities/verification-token.entity";
import { CreateChildDto } from "./dto/create-child.dto";
import { UpdateChildDto } from "./dto/update-child.dto";

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
  count: jest.fn(),
});

describe("ChildrenService", () => {
  let service: ChildrenService;

  let childRepo: ReturnType<typeof createMockRepository>;
  let childModuleRepo: ReturnType<typeof createMockRepository>;
  let childQuestRepo: ReturnType<typeof createMockRepository>;
  let childScreenRepo: ReturnType<typeof createMockRepository>;
  let userPlanRepo: ReturnType<typeof createMockRepository>;
  let userRepo: ReturnType<typeof createMockRepository>;
  let s3Service: { upload: jest.Mock; delete: jest.Mock };
  let kitService: { sendChildDeletionOtp: jest.Mock };
  let verificationService: { generateOtp: jest.Mock; verifyOtp: jest.Mock };

  const userId = "user-id-1";
  const childId = "child-id-1";

  beforeEach(async () => {
    childRepo = createMockRepository();
    childModuleRepo = createMockRepository();
    childQuestRepo = createMockRepository();
    childScreenRepo = createMockRepository();
    userPlanRepo = createMockRepository();
    userRepo = createMockRepository();

    s3Service = { upload: jest.fn(), delete: jest.fn() };
    kitService = { sendChildDeletionOtp: jest.fn() };
    verificationService = { generateOtp: jest.fn(), verifyOtp: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChildrenService,
        { provide: getRepositoryToken(Child), useValue: childRepo },
        { provide: getRepositoryToken(ChildModule), useValue: childModuleRepo },
        { provide: getRepositoryToken(ChildQuest), useValue: childQuestRepo },
        { provide: getRepositoryToken(ChildScreen), useValue: childScreenRepo },
        { provide: getRepositoryToken(UserPlan), useValue: userPlanRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: S3Service, useValue: s3Service },
        { provide: KitService, useValue: kitService },
        { provide: VerificationService, useValue: verificationService },
      ],
    }).compile();

    service = module.get<ChildrenService>(ChildrenService);

    jest.clearAllMocks();
    // restore default create mock behaviour after clearAllMocks
    childRepo.create.mockImplementation((data) => data);
    childModuleRepo.create.mockImplementation((data) => data);
    userPlanRepo.create.mockImplementation((data) => data);
  });

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------

  describe("create", () => {
    const dto: CreateChildDto = { name: "Alice", age: 8, gender: "female" };

    it("should throw ForbiddenException when no active plan exists", async () => {
      userPlanRepo.findOne.mockResolvedValue(null);

      await expect(service.create(userId, dto)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.create(userId, dto)).rejects.toThrow(
        "An active plan or trial is required",
      );
    });

    it("should throw ForbiddenException when trial child limit is reached", async () => {
      userPlanRepo.findOne.mockResolvedValue({
        id: "up-1",
        userId,
        isTrial: true,
        isActive: true,
        plan: null,
      });
      childRepo.countBy.mockResolvedValue(1); // already has 1 child; trial max = 1

      await expect(service.create(userId, dto)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.create(userId, dto)).rejects.toThrow(
        "Your plan allows a maximum of 1 child",
      );
    });

    it("should throw ForbiddenException when paid plan child limit is reached", async () => {
      userPlanRepo.findOne.mockResolvedValue({
        id: "up-1",
        userId,
        isTrial: false,
        isActive: true,
        plan: { maxChildren: 2 },
      });
      childRepo.countBy.mockResolvedValue(2);

      await expect(service.create(userId, dto)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.create(userId, dto)).rejects.toThrow(
        "Your plan allows a maximum of 2 children",
      );
    });

    it("should create and return a child when trial limit is not reached", async () => {
      userPlanRepo.findOne.mockResolvedValue({
        id: "up-1",
        userId,
        isTrial: true,
        isActive: true,
        plan: null,
      });
      childRepo.countBy.mockResolvedValue(0);
      const savedChild = { id: childId, userId, ...dto };
      childRepo.save.mockResolvedValue(savedChild);

      const result = await service.create(userId, dto);

      expect(childRepo.create).toHaveBeenCalledWith({ userId, ...dto });
      expect(childRepo.save).toHaveBeenCalled();
      expect(result).toBe(savedChild);
    });

    it("should create and return a child when paid plan limit is not reached", async () => {
      userPlanRepo.findOne.mockResolvedValue({
        id: "up-1",
        userId,
        isTrial: false,
        isActive: true,
        plan: { maxChildren: 4 },
      });
      childRepo.countBy.mockResolvedValue(2);
      const savedChild = { id: childId, userId, ...dto };
      childRepo.save.mockResolvedValue(savedChild);

      const result = await service.create(userId, dto);

      expect(childRepo.create).toHaveBeenCalledWith({ userId, ...dto });
      expect(childRepo.save).toHaveBeenCalled();
      expect(result).toBe(savedChild);
    });

    it("should treat missing plan.maxChildren as 0 (throws for paid plan with no plan object)", async () => {
      userPlanRepo.findOne.mockResolvedValue({
        id: "up-1",
        userId,
        isTrial: false,
        isActive: true,
        plan: null, // missing plan
      });
      childRepo.countBy.mockResolvedValue(0); // 0 >= 0 is true

      await expect(service.create(userId, dto)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // findAll
  // ---------------------------------------------------------------------------

  describe("findAll", () => {
    it("should return an empty array when the user has no children", async () => {
      childRepo.findBy.mockResolvedValue([]);

      const result = await service.findAll(userId);

      expect(result).toEqual([]);
    });

    it("should return children with null enrichment when there are no modules", async () => {
      const children = [{ id: childId, userId, name: "Alice" }];
      childRepo.findBy.mockResolvedValue(children);
      childModuleRepo.findBy.mockResolvedValue([]);

      const result = await service.findAll(userId);

      expect(result).toHaveLength(1);
      expect(result[0].avatar).toBeNull();
      expect(result[0].nextContent).toBeNull();
      expect(result[0].lastCompletedContent).toBeNull();
    });

    it("should return children with null enrichment when there are no quests", async () => {
      const children = [{ id: childId, userId, name: "Alice" }];
      childRepo.findBy.mockResolvedValue(children);
      childModuleRepo.findBy.mockResolvedValue([
        { id: "mod-1", childId, moduleNo: 1 },
      ]);
      childQuestRepo.findBy.mockResolvedValue([]);

      const result = await service.findAll(userId);

      expect(result).toHaveLength(1);
      expect(result[0].avatar).toBeNull();
      expect(result[0].nextContent).toBeNull();
      expect(result[0].lastCompletedContent).toBeNull();
    });

    it("should return children with screens but no completed screens", async () => {
      const children = [{ id: childId, userId, name: "Alice" }];
      childRepo.findBy.mockResolvedValue(children);
      childModuleRepo.findBy.mockResolvedValue([
        { id: "mod-1", childId, moduleNo: 1 },
      ]);
      childQuestRepo.findBy.mockResolvedValue([
        { id: "quest-1", moduleId: "mod-1", questNo: 1 },
      ]);
      childScreenRepo.findBy.mockResolvedValue([
        {
          id: "screen-1",
          questId: "quest-1",
          screenNo: 1,
          isCompleted: false,
          completedAt: null,
          data: null,
        },
      ]);

      const result = await service.findAll(userId);

      expect(result).toHaveLength(1);
      expect(result[0].avatar).toBeNull();
      expect(result[0].nextContent).toBeNull();
      expect(result[0].lastCompletedContent).toBeNull();
    });

    it("should derive avatar from m1/q6/s1 buddy_customization data", async () => {
      const children = [{ id: childId, userId, name: "Alice" }];
      childRepo.findBy.mockResolvedValue(children);

      const module1 = { id: "mod-1", childId, moduleNo: 1 };
      childModuleRepo.findBy.mockResolvedValue([module1]);

      const quest6 = { id: "quest-6", moduleId: "mod-1", questNo: 6 };
      childQuestRepo.findBy.mockResolvedValue([quest6]);

      const buddyData = {
        buddy_customization: {
          beard: "beard_1",
          glasses: "glasses_1",
          hats: "hat_1",
          outfits: "outfit_1",
        },
      };
      childScreenRepo.findBy.mockResolvedValue([
        {
          id: "screen-1",
          questId: "quest-6",
          screenNo: 1,
          isCompleted: true,
          completedAt: new Date("2024-01-01"),
          data: buddyData,
        },
      ]);

      const result = await service.findAll(userId);

      expect(result[0].avatar).toEqual({
        beard: "beard_1",
        glasses: "glasses_1",
        hats: "hat_1",
        outfits: "outfit_1",
      });
    });

    it("should return null avatar when buddy customization screen is not completed", async () => {
      const children = [{ id: childId, userId, name: "Alice" }];
      childRepo.findBy.mockResolvedValue(children);

      const module1 = { id: "mod-1", childId, moduleNo: 1 };
      childModuleRepo.findBy.mockResolvedValue([module1]);

      const quest6 = { id: "quest-6", moduleId: "mod-1", questNo: 6 };
      childQuestRepo.findBy.mockResolvedValue([quest6]);

      childScreenRepo.findBy.mockResolvedValue([
        {
          id: "screen-1",
          questId: "quest-6",
          screenNo: 1,
          isCompleted: false,
          completedAt: null,
          data: { buddy_customization: { beard: "beard_1" } },
        },
      ]);

      const result = await service.findAll(userId);

      expect(result[0].avatar).toBeNull();
    });

    it("should compute lastCompletedContent and nextContent for completed screens", async () => {
      const children = [{ id: childId, userId, name: "Alice" }];
      childRepo.findBy.mockResolvedValue(children);

      childModuleRepo.findBy.mockResolvedValue([
        { id: "mod-1", childId, moduleNo: 1 },
      ]);
      childQuestRepo.findBy.mockResolvedValue([
        { id: "quest-1", moduleId: "mod-1", questNo: 1 },
      ]);
      childScreenRepo.findBy.mockResolvedValue([
        {
          id: "screen-1",
          questId: "quest-1",
          screenNo: 1,
          isCompleted: true,
          completedAt: new Date("2024-01-01T10:00:00Z"),
          data: null,
        },
      ]);

      const result = await service.findAll(userId);

      expect(result[0].lastCompletedContent).toEqual({
        module: 1,
        quest: 1,
        screen: 1,
      });
      // moduleRegistry: module 1, quest 1 has 1 screen, so next is quest 2, screen 1
      expect(result[0].nextContent).toEqual({
        moduleNo: 1,
        questNo: 2,
        screenNo: 1,
      });
    });

    it("should pick the most recently completed screen when multiple exist", async () => {
      const children = [{ id: childId, userId, name: "Alice" }];
      childRepo.findBy.mockResolvedValue(children);

      childModuleRepo.findBy.mockResolvedValue([
        { id: "mod-1", childId, moduleNo: 1 },
      ]);
      childQuestRepo.findBy.mockResolvedValue([
        { id: "quest-1", moduleId: "mod-1", questNo: 1 },
        { id: "quest-2", moduleId: "mod-1", questNo: 2 },
      ]);
      childScreenRepo.findBy.mockResolvedValue([
        {
          id: "screen-1",
          questId: "quest-1",
          screenNo: 1,
          isCompleted: true,
          completedAt: new Date("2024-01-01T09:00:00Z"),
          data: null,
        },
        {
          id: "screen-2",
          questId: "quest-2",
          screenNo: 1,
          isCompleted: true,
          completedAt: new Date("2024-01-02T10:00:00Z"),
          data: null,
        },
      ]);

      const result = await service.findAll(userId);

      // Most recent is module 1, quest 2, screen 1
      expect(result[0].lastCompletedContent).toEqual({
        module: 1,
        quest: 2,
        screen: 1,
      });
    });
  });

  // ---------------------------------------------------------------------------
  // update
  // ---------------------------------------------------------------------------

  describe("update", () => {
    const dto: UpdateChildDto = { name: "Bob" };

    it("should throw NotFoundException when child is not found", async () => {
      childRepo.findOneBy.mockResolvedValue(null);

      await expect(service.update(userId, childId, dto)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.update(userId, childId, dto)).rejects.toThrow(
        "Child not found",
      );
    });

    it("should update and return the child", async () => {
      const child = {
        id: childId,
        userId,
        name: "Alice",
        age: 8,
        gender: "female",
      };
      childRepo.findOneBy.mockResolvedValue(child);
      const updatedChild = { ...child, name: "Bob" };
      childRepo.save.mockResolvedValue(updatedChild);

      const result = await service.update(userId, childId, dto);

      expect(childRepo.findOneBy).toHaveBeenCalledWith({ id: childId, userId });
      expect(childRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Bob" }),
      );
      expect(result).toBe(updatedChild);
    });
  });

  // ---------------------------------------------------------------------------
  // uploadProfileImage
  // ---------------------------------------------------------------------------

  describe("uploadProfileImage", () => {
    const file = {
      originalname: "photo.jpg",
      mimetype: "image/jpeg",
      buffer: Buffer.from(""),
    } as Express.Multer.File;

    it("should throw NotFoundException when child is not found", async () => {
      childRepo.findOneBy.mockResolvedValue(null);

      await expect(
        service.uploadProfileImage(userId, childId, file),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.uploadProfileImage(userId, childId, file),
      ).rejects.toThrow("Child not found");
    });

    it("should delete old S3 image before uploading a new one", async () => {
      const child = {
        id: childId,
        userId,
        name: "Alice",
        profileImage:
          "https://my-bucket.s3.us-east-1.amazonaws.com/children/old.jpg",
        avatar_type: "image",
      };
      childRepo.findOneBy.mockResolvedValue(child);
      s3Service.delete.mockResolvedValue(undefined);
      s3Service.upload.mockResolvedValue({
        key: "children/new.jpg",
        url: "https://my-bucket.s3.us-east-1.amazonaws.com/children/new.jpg",
      });
      const savedChild = {
        ...child,
        profileImage:
          "https://my-bucket.s3.us-east-1.amazonaws.com/children/new.jpg",
      };
      childRepo.save.mockResolvedValue(savedChild);

      const result = await service.uploadProfileImage(userId, childId, file);

      expect(s3Service.delete).toHaveBeenCalledWith("children/old.jpg");
      expect(s3Service.upload).toHaveBeenCalledWith(
        file,
        `children/${childId}`,
      );
      expect(childRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          profileImage:
            "https://my-bucket.s3.us-east-1.amazonaws.com/children/new.jpg",
          avatar_type: "image",
        }),
      );
      expect(result).toBe(savedChild);
    });

    it("should upload image without deleting when child has no existing profileImage", async () => {
      const child = {
        id: childId,
        userId,
        name: "Alice",
        profileImage: null,
        avatar_type: "prebuilt",
      };
      childRepo.findOneBy.mockResolvedValue(child);
      s3Service.upload.mockResolvedValue({
        key: "children/new.jpg",
        url: "https://my-bucket.s3.us-east-1.amazonaws.com/children/new.jpg",
      });
      childRepo.save.mockResolvedValue({
        ...child,
        profileImage:
          "https://my-bucket.s3.us-east-1.amazonaws.com/children/new.jpg",
        avatar_type: "image",
      });

      await service.uploadProfileImage(userId, childId, file);

      expect(s3Service.delete).not.toHaveBeenCalled();
      expect(s3Service.upload).toHaveBeenCalledWith(
        file,
        `children/${childId}`,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // removeProfileImage
  // ---------------------------------------------------------------------------

  describe("removeProfileImage", () => {
    it("should throw NotFoundException when child is not found", async () => {
      childRepo.findOneBy.mockResolvedValue(null);

      await expect(service.removeProfileImage(userId, childId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should delete S3 image and set profileImage to null", async () => {
      const child = {
        id: childId,
        userId,
        name: "Alice",
        profileImage:
          "https://my-bucket.s3.us-east-1.amazonaws.com/children/photo.jpg",
      };
      childRepo.findOneBy.mockResolvedValue(child);
      s3Service.delete.mockResolvedValue(undefined);
      const savedChild = { ...child, profileImage: null };
      childRepo.save.mockResolvedValue(savedChild);

      const result = await service.removeProfileImage(userId, childId);

      expect(s3Service.delete).toHaveBeenCalledWith("children/photo.jpg");
      expect(childRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ profileImage: null }),
      );
      expect(result).toBe(savedChild);
    });

    it("should return the child without calling S3 when there is no profileImage", async () => {
      const child = { id: childId, userId, name: "Alice", profileImage: null };
      childRepo.findOneBy.mockResolvedValue(child);

      const result = await service.removeProfileImage(userId, childId);

      expect(s3Service.delete).not.toHaveBeenCalled();
      expect(childRepo.save).not.toHaveBeenCalled();
      expect(result).toBe(child);
    });
  });

  // ---------------------------------------------------------------------------
  // requestDeletion
  // ---------------------------------------------------------------------------

  describe("requestDeletion", () => {
    it("should throw NotFoundException when child is not found", async () => {
      childRepo.findOneBy.mockResolvedValue(null);

      await expect(service.requestDeletion(userId, childId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.requestDeletion(userId, childId)).rejects.toThrow(
        "Child not found",
      );
    });

    it("should throw NotFoundException when user is not found", async () => {
      childRepo.findOneBy.mockResolvedValue({
        id: childId,
        userId,
        name: "Alice",
      });
      userRepo.findOneBy.mockResolvedValue(null);

      await expect(service.requestDeletion(userId, childId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.requestDeletion(userId, childId)).rejects.toThrow(
        "User not found",
      );
    });

    it("should generate OTP, send it via kitService and return success message", async () => {
      const child = { id: childId, userId, name: "Alice" };
      const user = { id: userId, email: "test@example.com", name: "Parent" };
      childRepo.findOneBy.mockResolvedValue(child);
      userRepo.findOneBy.mockResolvedValue(user);
      verificationService.generateOtp.mockResolvedValue("123456");
      kitService.sendChildDeletionOtp.mockResolvedValue(undefined);

      const result = await service.requestDeletion(userId, childId);

      expect(verificationService.generateOtp).toHaveBeenCalledWith(
        userId,
        VerificationType.CHILD_DELETION,
      );
      expect(kitService.sendChildDeletionOtp).toHaveBeenCalledWith(
        userId,
        child.name,
        "123456",
      );
      expect(result).toEqual({ message: "OTP sent to email" });
    });
  });

  // ---------------------------------------------------------------------------
  // delete
  // ---------------------------------------------------------------------------

  describe("delete", () => {
    const otp = "123456";

    it("should throw when OTP verification fails", async () => {
      verificationService.verifyOtp.mockRejectedValue(new Error("Invalid OTP"));

      await expect(service.delete(userId, childId, otp)).rejects.toThrow(
        "Invalid OTP",
      );
    });

    it("should throw NotFoundException when child is not found", async () => {
      verificationService.verifyOtp.mockResolvedValue(true);
      childRepo.findOneBy.mockResolvedValue(null);

      await expect(service.delete(userId, childId, otp)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.delete(userId, childId, otp)).rejects.toThrow(
        "Child not found",
      );
    });

    it("should delete child and all cascading data (with profileImage)", async () => {
      verificationService.verifyOtp.mockResolvedValue(true);
      const child = {
        id: childId,
        userId,
        name: "Alice",
        profileImage:
          "https://my-bucket.s3.us-east-1.amazonaws.com/children/photo.jpg",
      };
      childRepo.findOneBy.mockResolvedValue(child);
      s3Service.delete.mockResolvedValue(undefined);

      const modules = [
        { id: "mod-1", childId },
        { id: "mod-2", childId },
      ];
      childModuleRepo.findBy.mockResolvedValue(modules);

      const quests = [
        { id: "quest-1", moduleId: "mod-1" },
        { id: "quest-2", moduleId: "mod-2" },
      ];
      childQuestRepo.findBy.mockResolvedValue(quests);

      childScreenRepo.delete.mockResolvedValue(undefined);
      childQuestRepo.delete.mockResolvedValue(undefined);
      childModuleRepo.delete.mockResolvedValue(undefined);
      childRepo.remove.mockResolvedValue(undefined);

      await service.delete(userId, childId, otp);

      expect(verificationService.verifyOtp).toHaveBeenCalledWith(
        userId,
        VerificationType.CHILD_DELETION,
        otp,
      );
      expect(s3Service.delete).toHaveBeenCalledWith("children/photo.jpg");
      expect(childScreenRepo.delete).toHaveBeenCalledWith({
        questId: In(["quest-1", "quest-2"]),
      });
      expect(childQuestRepo.delete).toHaveBeenCalledWith({
        moduleId: In(["mod-1", "mod-2"]),
      });
      expect(childModuleRepo.delete).toHaveBeenCalledWith({ childId });
      expect(childRepo.remove).toHaveBeenCalledWith(child);
    });

    it("should delete child without S3 call when there is no profileImage", async () => {
      verificationService.verifyOtp.mockResolvedValue(true);
      const child = { id: childId, userId, name: "Alice", profileImage: null };
      childRepo.findOneBy.mockResolvedValue(child);

      childModuleRepo.findBy.mockResolvedValue([]);
      childRepo.remove.mockResolvedValue(undefined);

      await service.delete(userId, childId, otp);

      expect(s3Service.delete).not.toHaveBeenCalled();
      expect(childRepo.remove).toHaveBeenCalledWith(child);
    });

    it("should delete child with no modules without touching quest/screen repos", async () => {
      verificationService.verifyOtp.mockResolvedValue(true);
      const child = { id: childId, userId, name: "Alice", profileImage: null };
      childRepo.findOneBy.mockResolvedValue(child);

      childModuleRepo.findBy.mockResolvedValue([]);
      childRepo.remove.mockResolvedValue(undefined);

      await service.delete(userId, childId, otp);

      expect(childQuestRepo.findBy).not.toHaveBeenCalled();
      expect(childScreenRepo.delete).not.toHaveBeenCalled();
      expect(childQuestRepo.delete).not.toHaveBeenCalled();
      expect(childModuleRepo.delete).not.toHaveBeenCalled();
      expect(childRepo.remove).toHaveBeenCalledWith(child);
    });

    it("should skip screen/quest deletion when modules exist but quests are empty", async () => {
      verificationService.verifyOtp.mockResolvedValue(true);
      const child = { id: childId, userId, name: "Alice", profileImage: null };
      childRepo.findOneBy.mockResolvedValue(child);

      childModuleRepo.findBy.mockResolvedValue([{ id: "mod-1", childId }]);
      childQuestRepo.findBy.mockResolvedValue([]); // no quests
      childModuleRepo.delete.mockResolvedValue(undefined);
      childRepo.remove.mockResolvedValue(undefined);

      await service.delete(userId, childId, otp);

      expect(childScreenRepo.delete).not.toHaveBeenCalled();
      expect(childQuestRepo.delete).not.toHaveBeenCalled();
      expect(childModuleRepo.delete).toHaveBeenCalledWith({ childId });
      expect(childRepo.remove).toHaveBeenCalledWith(child);
    });

    it("should silently swallow S3 delete errors during child deletion", async () => {
      verificationService.verifyOtp.mockResolvedValue(true);
      const child = {
        id: childId,
        userId,
        name: "Alice",
        profileImage:
          "https://my-bucket.s3.us-east-1.amazonaws.com/children/photo.jpg",
      };
      childRepo.findOneBy.mockResolvedValue(child);
      s3Service.delete.mockRejectedValue(new Error("S3 error"));

      childModuleRepo.findBy.mockResolvedValue([]);
      childRepo.remove.mockResolvedValue(undefined);

      // Should not throw
      await expect(
        service.delete(userId, childId, otp),
      ).resolves.toBeUndefined();
      expect(childRepo.remove).toHaveBeenCalledWith(child);
    });
  });
});
