import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Resource } from "./entities/resource.entity";
import { Document } from "./entities/document.entity";
import { S3Service } from "./s3.service";
import { StorageService } from "./storage.service";

@Module({
  imports: [TypeOrmModule.forFeature([Resource, Document])],
  providers: [S3Service, StorageService],
  exports: [StorageService, S3Service],
})
export class StorageModule {}
