import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { FeedbackController } from "./feedback.controller";
import { FeedbackService } from "./feedback.service";
import { Child } from "../children/entities/child.entity";
import { ChildFeedback } from "./entities/child-feedback.entity";
import { FeedbackReportModule } from "../feedback-report/feedback-report.module";

@Module({
  imports: [TypeOrmModule.forFeature([Child, ChildFeedback]), FeedbackReportModule],
  controllers: [FeedbackController],
  providers: [FeedbackService],
})
export class FeedbackModule {}
