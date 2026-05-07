import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { AppConfig } from "../../config/app.config";
import { randomUUID } from "crypto";
import * as path from "path";

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private client: S3Client;
  private bucket: string;
  private region: string;

  constructor(private configService: ConfigService<AppConfig>) {
    const { region, accessKeyId, secretAccessKey, bucket } =
      this.configService.get("s3", { infer: true });

    this.client = new S3Client({
      region,
      credentials: { accessKeyId, secretAccessKey },
    });
    this.bucket = bucket;
    this.region = region;
  }

  async upload(
    file: Express.Multer.File,
    folder: string,
  ): Promise<{ key: string; url: string }> {
    const ext = path.extname(file.originalname);
    const key = `${folder}/${randomUUID()}${ext}`;

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );
    } catch (err) {
      this.logger.error(
        `S3 upload failed — bucket: ${this.bucket}, key: ${key}`,
        err,
      );
      throw err;
    }

    const url = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
    this.logger.log(
      `S3 upload successful — bucket: ${this.bucket}, key: ${key}, url: ${url}`,
    );
    return { key, url };
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}
