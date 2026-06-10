import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ProgressController } from "./progress.controller";
import { ProgressService } from "./progress.service";
import { Child } from "../children/entities/child.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Child])],
  controllers: [ProgressController],
  providers: [ProgressService],
})
export class ProgressModule {}
