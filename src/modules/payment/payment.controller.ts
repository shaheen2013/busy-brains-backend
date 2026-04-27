import { Body, Controller, Post } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { PaymentService } from "./payment.service";
import { StartTrialDto } from "./dto/start-trial.dto";
import { User } from "../auth/decorators/user.decorator";
import { User as UserEntity } from "../users/entities/user.entity";

@ApiTags("Payment")
@ApiBearerAuth("Clerk-Bearer")
@Controller("payment")
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post("start-trial")
  @ApiOperation({ summary: "Start a 14-day free trial for SOLO_EXPLORER or FAMILY_PACK" })
  startTrial(
    @User() user: UserEntity,
    @Body() dto: StartTrialDto,
  ) {
    return this.paymentService.startTrial(user, dto.planName);
  }
}
