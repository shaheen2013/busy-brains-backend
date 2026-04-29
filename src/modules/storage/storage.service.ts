import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Resource } from "./entities/resource.entity";
import { Document } from "./entities/document.entity";
import { S3Service } from "./s3.service";

@Injectable()
export class StorageService {
  constructor(
    @InjectRepository(Resource)
    private resourceRepository: Repository<Resource>,
    @InjectRepository(Document)
    private documentRepository: Repository<Document>,
    private s3Service: S3Service,
  ) {}

  async upsertProfileImage(
    entityType: string,
    entityId: string,
    file: Express.Multer.File,
  ): Promise<Document> {
    let resource = await this.resourceRepository.findOne({
      where: { entityType, entityId },
      relations: { documents: true },
    });

    if (!resource) {
      resource = await this.resourceRepository.save(
        this.resourceRepository.create({ entityType, entityId }),
      );
      resource.documents = [];
    }

    // Delete previous profile image from S3 and DB
    const existing = resource.documents.find((d) => d.label === "profile");
    if (existing) {
      await this.s3Service.delete(existing.key);
      await this.documentRepository.delete(existing.id);
    }

    const { key, url } = await this.s3Service.upload(
      file,
      `${entityType}/${entityId}`,
    );

    const doc = await this.documentRepository.save(
      this.documentRepository.create({
        resourceId: resource.id,
        key,
        url,
        mimeType: file.mimetype,
        size: file.size,
        label: "profile",
      }),
    );

    return doc;
  }

  async getResource(
    entityType: string,
    entityId: string,
  ): Promise<Resource | null> {
    return this.resourceRepository.findOne({
      where: { entityType, entityId },
      relations: { documents: true },
    });
  }
}
