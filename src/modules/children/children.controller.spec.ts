import { Test, TestingModule } from "@nestjs/testing";
import { ChildrenController } from "./children.controller";
import { ChildrenService } from "./children.service";
import { CreateChildDto } from "./dto/create-child.dto";
import { UpdateChildDto } from "./dto/update-child.dto";
import { DeleteChildDto } from "./dto/delete-child.dto";
import { User as UserEntity } from "../users/entities/user.entity";

const mockChildrenService = {
  findAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  uploadProfileImage: jest.fn(),
  removeProfileImage: jest.fn(),
  delete: jest.fn(),
  requestDeletion: jest.fn(),
};

const mockUser: Partial<UserEntity> = {
  id: "user-id-1",
  name: "Test User",
  email: "test@example.com",
};

describe("ChildrenController", () => {
  let controller: ChildrenController;
  let service: typeof mockChildrenService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChildrenController],
      providers: [{ provide: ChildrenService, useValue: mockChildrenService }],
    }).compile();

    controller = module.get<ChildrenController>(ChildrenController);
    service = module.get(ChildrenService);

    jest.clearAllMocks();
  });

  describe("findAll", () => {
    it("should call childrenService.findAll with user.id", async () => {
      const expected = [{ id: "child-1", name: "Alice" }];
      service.findAll.mockResolvedValue(expected);

      const result = await controller.findAll(mockUser as UserEntity);

      expect(service.findAll).toHaveBeenCalledWith(mockUser.id);
      expect(result).toBe(expected);
    });

    it("should return an empty array when there are no children", async () => {
      service.findAll.mockResolvedValue([]);

      const result = await controller.findAll(mockUser as UserEntity);

      expect(service.findAll).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual([]);
    });
  });

  describe("create", () => {
    it("should call childrenService.create with user.id and dto", async () => {
      const dto: CreateChildDto = { name: "Alice", age: 8, gender: "female" };
      const created = { id: "child-1", userId: mockUser.id, ...dto };
      service.create.mockResolvedValue(created);

      const result = await controller.create(mockUser as UserEntity, dto);

      expect(service.create).toHaveBeenCalledWith(mockUser.id, dto);
      expect(result).toBe(created);
    });
  });

  describe("update", () => {
    it("should call childrenService.update with user.id, id and dto", async () => {
      const dto: UpdateChildDto = { name: "Alice Updated" };
      const updated = {
        id: "child-1",
        userId: mockUser.id,
        name: "Alice Updated",
      };
      service.update.mockResolvedValue(updated);

      const result = await controller.update(
        mockUser as UserEntity,
        "child-1",
        dto,
      );

      expect(service.update).toHaveBeenCalledWith(mockUser.id, "child-1", dto);
      expect(result).toBe(updated);
    });
  });

  describe("uploadProfileImage", () => {
    it("should call childrenService.uploadProfileImage with user.id, id and file", async () => {
      const file = {
        originalname: "photo.jpg",
        mimetype: "image/jpeg",
        buffer: Buffer.from(""),
      } as Express.Multer.File;
      const updated = {
        id: "child-1",
        profileImage: "https://s3.example.com/photo.jpg",
      };
      service.uploadProfileImage.mockResolvedValue(updated);

      const result = await controller.uploadProfileImage(
        mockUser as UserEntity,
        "child-1",
        file,
      );

      expect(service.uploadProfileImage).toHaveBeenCalledWith(
        mockUser.id,
        "child-1",
        file,
      );
      expect(result).toBe(updated);
    });
  });

  describe("removeProfileImage", () => {
    it("should call childrenService.removeProfileImage with user.id and id", async () => {
      const updated = { id: "child-1", profileImage: null };
      service.removeProfileImage.mockResolvedValue(updated);

      const result = await controller.removeProfileImage(
        mockUser as UserEntity,
        "child-1",
      );

      expect(service.removeProfileImage).toHaveBeenCalledWith(
        mockUser.id,
        "child-1",
      );
      expect(result).toBe(updated);
    });
  });

  describe("delete", () => {
    it("should call childrenService.delete with user.id, id and dto.otp", async () => {
      const dto: DeleteChildDto = { otp: "123456" };
      service.delete.mockResolvedValue(undefined);

      const result = await controller.delete(
        mockUser as UserEntity,
        "child-1",
        dto,
      );

      expect(service.delete).toHaveBeenCalledWith(
        mockUser.id,
        "child-1",
        dto.otp,
      );
      expect(result).toBeUndefined();
    });
  });

  describe("requestDeletion", () => {
    it("should call childrenService.requestDeletion with user.id and id", async () => {
      const response = { message: "OTP sent to email" };
      service.requestDeletion.mockResolvedValue(response);

      const result = await controller.requestDeletion(
        mockUser as UserEntity,
        "child-1",
      );

      expect(service.requestDeletion).toHaveBeenCalledWith(
        mockUser.id,
        "child-1",
      );
      expect(result).toBe(response);
    });
  });
});
