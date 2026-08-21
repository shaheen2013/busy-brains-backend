import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Body, Controller, Get, Post } from "@nestjs/common";
import { WeeklySubscriptionService } from "./weekly-subscription.service";
import { User } from "../auth/decorators/user.decorator";
import { User as UserEntity } from "../users/entities/user.entity";
import { StartWeeklySubscriptionDto } from "./dto/start-weekly-subscription.dto";
import { PayoffWeeklySubscriptionDto } from "./dto/payoff-weekly-subscription.dto";

@ApiTags("Weekly Subscription")
@ApiBearerAuth("Clerk-Bearer")
@Controller("weekly-subscription")
export class WeeklySubscriptionController {
  constructor(
    private readonly weeklySubscriptionService: WeeklySubscriptionService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Get the authenticated user's weekly subscription" })
  getCurrent(@User() user: UserEntity) {
    return this.weeklySubscriptionService.getCurrent(user.id);
  }

  @Post("start")
  @ApiOperation({
    summary: "Start a new weekly recurring subscription (Single or Family)",
  })
  start(@User() user: UserEntity, @Body() dto: StartWeeklySubscriptionDto) {
    return this.weeklySubscriptionService.start(
      user,
      dto.tier,
      dto.paymentMethodId,
    );
  }

  @Post("payoff")
  @ApiOperation({
    summary:
      "Pay off the remaining weekly cycles in one charge, optionally at a higher tier",
  })
  payoff(@User() user: UserEntity, @Body() dto: PayoffWeeklySubscriptionDto) {
    return this.weeklySubscriptionService.payoff(user, dto.targetTier);
  }

  @Post("upgrade")
  @ApiOperation({
    summary:
      "Upgrade Single to Family, staying recurring (charges catch-up differential)",
  })
  upgrade(@User() user: UserEntity) {
    return this.weeklySubscriptionService.upgrade(user);
  }

  @Post("request-cancel-otp")
  @ApiOperation({
    summary:
      "Send an OTP to the user's email to confirm subscription cancellation",
  })
  requestCancelOtp(@User() user: UserEntity) {
    return this.weeklySubscriptionService.requestCancelOtp(user);
  }

  @Post("cancel")
  @ApiOperation({
    summary:
      "Cancel the weekly subscription outright, no proration (requires OTP)",
  })
  cancel(@User() user: UserEntity, @Body("otp") otp: string) {
    return this.weeklySubscriptionService.cancel(user, otp);
  }
}
