import { ForbiddenException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Child } from "../children/entities/child.entity";
import { ChildFeedback } from "./entities/child-feedback.entity";
import { CreateFeedbackDto } from "./dto/create-feedback.dto";

@Injectable()
export class FeedbackService {
  constructor(
    @InjectRepository(Child)
    private readonly childRepository: Repository<Child>,
    @InjectRepository(ChildFeedback)
    private readonly feedbackRepository: Repository<ChildFeedback>,
  ) {}

  private async assertOwnedChild(userId: string, childId: string) {
    const child = await this.childRepository.findOneBy({ id: childId, userId });
    if (!child) throw new ForbiddenException("Child not found");
    return child;
  }

  // Upsert: two feedback records per child (one by parent, one by child).
  // Re-submitting overwrites the existing payload for the given byChild value.
  async upsert(
    userId: string,
    childId: string,
    dto: CreateFeedbackDto,
  ): Promise<ChildFeedback> {
    await this.assertOwnedChild(userId, childId);

    const byChild = dto.byChild ?? false;
    const existing = await this.feedbackRepository.findOneBy({ childId, byChild });
    const entity = existing ?? this.feedbackRepository.create({ childId, byChild });
    entity.feedback = dto.feedback;
    entity.submittedAt = new Date();

    return this.feedbackRepository.save(entity);
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
