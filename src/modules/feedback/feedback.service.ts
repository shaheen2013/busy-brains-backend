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

  // Upsert: one feedback record per child. Re-submitting overwrites the
  // existing payload and refreshes the submission time.
  async upsert(
    userId: string,
    childId: string,
    dto: CreateFeedbackDto,
  ): Promise<ChildFeedback> {
    await this.assertOwnedChild(userId, childId);

    const existing = await this.feedbackRepository.findOneBy({ childId });
    const entity = existing ?? this.feedbackRepository.create({ childId });
    entity.feedback = dto.feedback;
    entity.submittedAt = new Date();

    return this.feedbackRepository.save(entity);
  }

  // Returns the child's single feedback record, or null if none submitted yet.
  async findOne(
    userId: string,
    childId: string,
  ): Promise<ChildFeedback | null> {
    await this.assertOwnedChild(userId, childId);

    return this.feedbackRepository.findOneBy({ childId });
  }
}
