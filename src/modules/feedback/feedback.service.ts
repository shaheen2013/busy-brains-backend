import { ForbiddenException, Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Child } from "../children/entities/child.entity";
import { ChildFeedback } from "./entities/child-feedback.entity";
import { CreateFeedbackDto } from "./dto/create-feedback.dto";
import { FeedbackReportService } from "../feedback-report/feedback-report.service";

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);

  constructor(
    @InjectRepository(Child)
    private readonly childRepository: Repository<Child>,
    @InjectRepository(ChildFeedback)
    private readonly feedbackRepository: Repository<ChildFeedback>,
    private readonly feedbackReportService: FeedbackReportService,
  ) {}

  private async assertOwnedChild(userId: string, childId: string) {
    const child = await this.childRepository.findOneBy({ id: childId, userId });
    if (!child) throw new ForbiddenException("Child not found");
    return child;
  }

  // Upsert: two feedback records per child (one by parent, one by child).
  // Re-submitting overwrites the existing payload for the given byChild value.
  // Only a completed submission (not an interim autosave) generates a PDF
  // report and uploads it to S3.
  async upsert(
    userId: string,
    childId: string,
    dto: CreateFeedbackDto,
  ): Promise<ChildFeedback> {
    await this.assertOwnedChild(userId, childId);

    const byChild = dto.byChild ?? false;
    const completed = dto.completed ?? true;
    const existing = await this.feedbackRepository.findOneBy({
      childId,
      byChild,
    });
    const entity =
      existing ?? this.feedbackRepository.create({ childId, byChild });
    entity.feedback = dto.feedback;
    entity.submittedAt = new Date();

    const saved = await this.feedbackRepository.save(entity);

    if (completed) {
      try {
        if (byChild) {
          await this.feedbackReportService.generateAndUploadChildPdf(
            userId,
            childId,
          );
        } else {
          await this.feedbackReportService.generateAndUploadPdf(
            userId,
            childId,
          );
        }
      } catch (err) {
        this.logger.error(
          `Failed to generate feedback PDF for child ${childId}`,
          err,
        );
        // Don't fail the feedback submission if PDF generation fails
      }
    }

    return saved;
  }

  // Returns the child's feedback record for the given byChild filter, or null if none submitted yet.
  async findOne(
    userId: string,
    childId: string,
    byChild?: boolean,
  ): Promise<ChildFeedback | null> {
    await this.assertOwnedChild(userId, childId);

    return this.feedbackRepository.findOneBy(
      byChild !== undefined ? { childId, byChild } : { childId },
    );
  }

  // Returns whether feedback has been submitted for this child.
  // If byChild is provided, checks only that specific record; otherwise checks any.
  async isSubmitted(
    userId: string,
    childId: string,
    byChild?: boolean,
  ): Promise<boolean> {
    await this.assertOwnedChild(userId, childId);

    const count = await this.feedbackRepository.countBy(
      byChild !== undefined ? { childId, byChild } : { childId },
    );
    return count > 0;
  }
}
