import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ProgressController } from "./progress.controller";
import { ProgressService } from "./progress.service";
import { Child } from "../children/entities/child.entity";
import { KitModule } from "../kit/kit.module";

@Module({
  imports: [TypeOrmModule.forFeature([Child]), KitModule],
  controllers: [ProgressController],
  providers: [ProgressService],
})
export class ProgressModule {}
