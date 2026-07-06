import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Child } from "../children/entities/child.entity";
import { User } from "../users/entities/user.entity";
import { ChildFeedback } from "../feedback/entities/child-feedback.entity";
import { StorageModule } from "../storage/storage.module";
import { KitModule } from "../kit/kit.module";
import { FeedbackReportController } from "./feedback-report.controller";
import { FeedbackReportService } from "./feedback-report.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([Child, User, ChildFeedback]),
    StorageModule,
    KitModule,
  ],
  controllers: [FeedbackReportController],
  providers: [FeedbackReportService],
  exports: [FeedbackReportService],
})
export class FeedbackReportModule {}

