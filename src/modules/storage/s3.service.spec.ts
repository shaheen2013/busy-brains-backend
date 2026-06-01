import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { S3Service } from "./s3.service";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

jest.mock("@aws-sdk/client-s3", () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({}),
  })),
  PutObjectCommand: jest.fn().mockImplementation((params) => ({ params })),
  DeleteObjectCommand: jest.fn().mockImplementation((params) => ({ params })),
}));

jest.mock("crypto", () => ({
  ...jest.requireActual("crypto"),
  randomUUID: jest.fn().mockReturnValue("test-uuid-1234"),
}));

const MOCK_S3_CONFIG = {
  region: "us-east-1",
  accessKeyId: "test-access-key",
  secretAccessKey: "test-secret-key",
  bucket: "test-bucket",
};

describe("S3Service", () => {
  let service: S3Service;
  let mockS3Send: jest.Mock;

  const mockConfigService = {
    get: jest.fn().mockReturnValue(MOCK_S3_CONFIG),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    mockS3Send = jest.fn().mockResolvedValue({});
    (S3Client as jest.Mock).mockImplementation(() => ({ send: mockS3Send }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        S3Service,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<S3Service>(S3Service);
  });

  describe("upload", () => {
    const mockFile: Express.Multer.File = {
      originalname: "photo.jpg",
      mimetype: "image/jpeg",
      buffer: Buffer.from("fake-image-data"),
      size: 15,
      fieldname: "file",
      encoding: "7bit",
      destination: "",
      filename: "",
      path: "",
      stream: null,
    };

    it("returns correct { key, url } format", async () => {
      const result = await service.upload(mockFile, "users/user-123");

      expect(result).toEqual({
        key: "users/user-123/test-uuid-1234.jpg",
        url: "https://test-bucket.s3.us-east-1.amazonaws.com/users/user-123/test-uuid-1234.jpg",
      });
    });

    it("sends PutObjectCommand with correct params", async () => {
      await service.upload(mockFile, "users/user-123");

      expect(PutObjectCommand).toHaveBeenCalledWith({
        Bucket: MOCK_S3_CONFIG.bucket,
        Key: "users/user-123/test-uuid-1234.jpg",
        Body: mockFile.buffer,
        ContentType: mockFile.mimetype,
      });
      expect(mockS3Send).toHaveBeenCalledTimes(1);
    });

    it("throws when S3 client.send fails", async () => {
      const s3Error = new Error("S3 connection refused");
      mockS3Send.mockRejectedValueOnce(s3Error);

      await expect(service.upload(mockFile, "users/user-123")).rejects.toThrow(
        "S3 connection refused",
      );
    });

    it("constructs key using folder and uuid with correct extension", async () => {
      const fileWithPng: Express.Multer.File = {
        ...mockFile,
        originalname: "avatar.png",
        mimetype: "image/png",
      };

      const result = await service.upload(fileWithPng, "avatars/profile");

      expect(result.key).toBe("avatars/profile/test-uuid-1234.png");
    });
  });

  describe("delete", () => {
    it("sends DeleteObjectCommand with correct key", async () => {
      const key = "users/user-123/test-uuid-1234.jpg";

      await service.delete(key);

      expect(DeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: MOCK_S3_CONFIG.bucket,
        Key: key,
      });
      expect(mockS3Send).toHaveBeenCalledTimes(1);
    });

    it("propagates error thrown by S3 client during delete", async () => {
      const s3Error = new Error("Access denied");
      mockS3Send.mockRejectedValueOnce(s3Error);

      await expect(service.delete("some/key.jpg")).rejects.toThrow(
        "Access denied",
      );
    });
  });
});
