import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { FeedbackController } from "./feedback.controller";
import { FeedbackService } from "./feedback.service";
import { Child } from "../children/entities/child.entity";
import { ChildFeedback } from "./entities/child-feedback.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Child, ChildFeedback])],
  controllers: [FeedbackController],
  providers: [FeedbackService],
})
export class FeedbackModule {}
