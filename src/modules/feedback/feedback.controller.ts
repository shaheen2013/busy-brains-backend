import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
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
    summary:
      "Submit JSON feedback for a child (upserts the record for parent or child)",
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
  @ApiQuery({
    name: "byChild",
    required: false,
    type: Boolean,
    description:
      "Filter by feedback submitted by the child (true) or parent (false)",
  })
  findOne(
    @User() user: UserEntity,
    @Param("childId") childId: string,
    @Query("byChild") byChild?: string,
  ) {
    const parsed =
      byChild === undefined ? undefined : byChild === "true" || byChild === "1";
    return this.feedbackService.findOne(user.id, childId, parsed);
  }

  @Get("submitted")
  @ApiOperation({
    summary: "Check whether feedback has been submitted for a child",
  })
  @ApiQuery({
    name: "byChild",
    required: false,
    type: Boolean,
    description:
      "Filter by feedback submitted by the child (true) or parent (false)",
  })
  async isSubmitted(
    @User() user: UserEntity,
    @Param("childId") childId: string,
    @Query("byChild") byChild?: string,
  ) {
    const parsed =
      byChild === undefined ? undefined : byChild === "true" || byChild === "1";
    return {
      submitted: await this.feedbackService.isSubmitted(
        user.id,
        childId,
        parsed,
      ),
    };
  }
}
