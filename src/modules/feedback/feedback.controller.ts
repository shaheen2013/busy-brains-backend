import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { FeedbackService } from "./feedback.service";
import { CreateFeedbackDto } from "./dto/create-feedback.dto";
import { User } from "../auth/decorators/user.decorator";
import { User as UserEntity } from "../users/entities/user.entity";

@ApiTags("Feedback")
@ApiBearerAuth("Clerk-Bearer")
@Controller("children/:childId/feedback")
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  @ApiOperation({
    summary: "Submit JSON feedback for a child (upserts the single record)",
  })
  create(
    @User() user: UserEntity,
    @Param("childId") childId: string,
    @Body() dto: CreateFeedbackDto,
  ) {
    return this.feedbackService.upsert(user.id, childId, dto);
  }

  @Get()
  @ApiOperation({ summary: "Get the feedback record for a child (or null)" })
  findOne(@User() user: UserEntity, @Param("childId") childId: string) {
    return this.feedbackService.findOne(user.id, childId);
  }

  @Get("submitted")
  @ApiOperation({
    summary: "Check whether feedback has been submitted for a child",
  })
  async isSubmitted(
    @User() user: UserEntity,
    @Param("childId") childId: string,
  ) {
    return {
      submitted: await this.feedbackService.isSubmitted(user.id, childId),
    };
  }
}
