import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { StorageService } from "./storage.service";
import { S3Service } from "./s3.service";
import { Resource } from "./entities/resource.entity";
import { Document } from "./entities/document.entity";

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

describe("StorageService", () => {
  let service: StorageService;
  let resourceRepository: ReturnType<typeof createMockRepository>;
  let documentRepository: ReturnType<typeof createMockRepository>;
  let s3Service: { upload: jest.Mock; delete: jest.Mock };

  beforeEach(async () => {
    resourceRepository = createMockRepository();
    documentRepository = createMockRepository();
    s3Service = {
      upload: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        { provide: getRepositoryToken(Resource), useValue: resourceRepository },
        { provide: getRepositoryToken(Document), useValue: documentRepository },
        { provide: S3Service, useValue: s3Service },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
  });

  const mockFile: Express.Multer.File = {
    originalname: "photo.jpg",
    mimetype: "image/jpeg",
    buffer: Buffer.from("fake"),
    size: 1024,
    fieldname: "file",
    encoding: "7bit",
    destination: "",
    filename: "",
    path: "",
    stream: null,
  };

  describe("upsertProfileImage", () => {
    it("creates new resource when none exists, uploads and saves document", async () => {
      resourceRepository.findOne.mockResolvedValueOnce(null);
      const savedResource: Partial<Resource> = {
        id: "resource-id",
        entityType: "user",
        entityId: "user-1",
      };
      resourceRepository.save.mockResolvedValueOnce(savedResource);

      const uploadedFile = {
        key: "user/user-1/uuid.jpg",
        url: "https://bucket.s3.us-east-1.amazonaws.com/user/user-1/uuid.jpg",
      };
      s3Service.upload.mockResolvedValueOnce(uploadedFile);

      const savedDoc: Partial<Document> = {
        id: "doc-id",
        resourceId: "resource-id",
        key: uploadedFile.key,
        url: uploadedFile.url,
        mimeType: mockFile.mimetype,
        size: mockFile.size,
        label: "profile",
      };
      documentRepository.save.mockResolvedValueOnce(savedDoc);

      const result = await service.upsertProfileImage(
        "user",
        "user-1",
        mockFile,
      );

      expect(resourceRepository.findOne).toHaveBeenCalledWith({
        where: { entityType: "user", entityId: "user-1" },
        relations: { documents: true },
      });
      expect(resourceRepository.create).toHaveBeenCalledWith({
        entityType: "user",
        entityId: "user-1",
      });
      expect(resourceRepository.save).toHaveBeenCalled();
      expect(s3Service.delete).not.toHaveBeenCalled();
      expect(s3Service.upload).toHaveBeenCalledWith(mockFile, "user/user-1");
      expect(documentRepository.create).toHaveBeenCalledWith({
        resourceId: "resource-id",
        key: uploadedFile.key,
        url: uploadedFile.url,
        mimeType: mockFile.mimetype,
        size: mockFile.size,
        label: "profile",
      });
      expect(documentRepository.save).toHaveBeenCalled();
      expect(result).toEqual(savedDoc);
    });

    it("deletes existing profile document from S3 and DB when resource already has one", async () => {
      const existingDoc: Partial<Document> = {
        id: "old-doc-id",
        label: "profile",
        key: "user/user-1/old-uuid.jpg",
      };
      const existingResource: Partial<Resource> = {
        id: "resource-id",
        entityType: "user",
        entityId: "user-1",
        documents: [existingDoc as Document],
      };
      resourceRepository.findOne.mockResolvedValueOnce(existingResource);

      const uploadedFile = {
        key: "user/user-1/new-uuid.jpg",
        url: "https://bucket.s3.us-east-1.amazonaws.com/user/user-1/new-uuid.jpg",
      };
      s3Service.delete.mockResolvedValueOnce(undefined);
      s3Service.upload.mockResolvedValueOnce(uploadedFile);
      documentRepository.delete.mockResolvedValueOnce({ affected: 1 });

      const savedDoc: Partial<Document> = {
        id: "new-doc-id",
        label: "profile",
        key: uploadedFile.key,
        url: uploadedFile.url,
      };
      documentRepository.save.mockResolvedValueOnce(savedDoc);

      const result = await service.upsertProfileImage(
        "user",
        "user-1",
        mockFile,
      );

      expect(s3Service.delete).toHaveBeenCalledWith(existingDoc.key);
      expect(documentRepository.delete).toHaveBeenCalledWith(existingDoc.id);
      expect(s3Service.upload).toHaveBeenCalledWith(mockFile, "user/user-1");
      expect(result).toEqual(savedDoc);
    });

    it("when resource exists with no profile doc, just uploads and saves", async () => {
      const nonProfileDoc: Partial<Document> = {
        id: "other-doc-id",
        label: "banner",
        key: "user/user-1/banner.jpg",
      };
      const existingResource: Partial<Resource> = {
        id: "resource-id",
        entityType: "user",
        entityId: "user-1",
        documents: [nonProfileDoc as Document],
      };
      resourceRepository.findOne.mockResolvedValueOnce(existingResource);

      const uploadedFile = {
        key: "user/user-1/uuid.jpg",
        url: "https://bucket.s3.us-east-1.amazonaws.com/user/user-1/uuid.jpg",
      };
      s3Service.upload.mockResolvedValueOnce(uploadedFile);

      const savedDoc: Partial<Document> = {
        id: "doc-id",
        label: "profile",
        key: uploadedFile.key,
      };
      documentRepository.save.mockResolvedValueOnce(savedDoc);

      await service.upsertProfileImage("user", "user-1", mockFile);

      expect(s3Service.delete).not.toHaveBeenCalled();
      expect(documentRepository.delete).not.toHaveBeenCalled();
      expect(s3Service.upload).toHaveBeenCalledWith(mockFile, "user/user-1");
    });
  });

  describe("getResource", () => {
    it("returns resource with documents when found", async () => {
      const resource: Partial<Resource> = {
        id: "resource-id",
        entityType: "user",
        entityId: "user-1",
        documents: [{ id: "doc-id", label: "profile" } as Document],
      };
      resourceRepository.findOne.mockResolvedValueOnce(resource);

      const result = await service.getResource("user", "user-1");

      expect(resourceRepository.findOne).toHaveBeenCalledWith({
        where: { entityType: "user", entityId: "user-1" },
        relations: { documents: true },
      });
      expect(result).toEqual(resource);
    });

    it("returns null when resource does not exist", async () => {
      resourceRepository.findOne.mockResolvedValueOnce(null);

      const result = await service.getResource("user", "nonexistent");

      expect(result).toBeNull();
    });
  });
});
