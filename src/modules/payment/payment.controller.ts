import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Body, Controller, Get, Post } from "@nestjs/common";
import { PaymentService } from "./payment.service";
import { User } from "../auth/decorators/user.decorator";
import { User as UserEntity } from "../users/entities/user.entity";
import { StartPlanDto } from "./dto/start-plan.dto";

@ApiTags("Payment")
@ApiBearerAuth("Clerk-Bearer")
@Controller("payment")
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post("start-trial")
  @ApiOperation({ summary: "Start a 14-day free trial (plan-agnostic)" })
  startTrial(@User() user: UserEntity) {
    return this.paymentService.startTrial(user);
  }

  @Post("start-plan")
  @ApiOperation({
    summary: "Start a paid subscription for SOLO_EXPLORER or FAMILY_PACK",
  })
  startPlan(@User() user: UserEntity, @Body() dto: StartPlanDto) {
    return this.paymentService.startPlan(user, dto.planName);
  }

  @Post("save-payment-method")
  @ApiOperation({
    summary: "Save a payment method (from Stripe Elements)",
    description: "Attach a PaymentMethod to the customer and set as default",
  })
  savePaymentMethod(
    @User() user: UserEntity,
    @Body() dto: { paymentMethodId: string },
  ) {
    return this.paymentService.savePaymentMethod(user, dto.paymentMethodId);
  }

  @Get("history")
  @ApiOperation({ summary: "Get payment history for the authenticated user" })
  getHistory(@User() user: UserEntity) {
    return this.paymentService.getPaymentHistory(user.id);
  }
}
