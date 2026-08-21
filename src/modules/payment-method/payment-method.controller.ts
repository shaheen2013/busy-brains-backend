import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Body, Controller, Delete, Get, Post } from "@nestjs/common";
import { PaymentMethodService } from "./payment-method.service";
import { User } from "../auth/decorators/user.decorator";
import { User as UserEntity } from "../users/entities/user.entity";
import { UpdatePaymentMethodDto } from "./dto/update-payment-method.dto";

@ApiTags("Payment Method")
@ApiBearerAuth("Clerk-Bearer")
@Controller("payment-method")
export class PaymentMethodController {
  constructor(private readonly paymentMethodService: PaymentMethodService) {}

  @Get()
  @ApiOperation({
    summary: "Show the authenticated user's current default card",
  })
  getCurrent(@User() user: UserEntity) {
    return this.paymentMethodService.getCurrent(user);
  }

  @Post()
  @ApiOperation({
    summary:
      "Update the default card, then retry any outstanding failed weekly payments",
  })
  update(@User() user: UserEntity, @Body() dto: UpdatePaymentMethodDto) {
    return this.paymentMethodService.update(user, dto.paymentMethodId);
  }

  @Delete()
  @ApiOperation({
    summary: "Remove the authenticated user's saved default card",
  })
  remove(@User() user: UserEntity) {
    return this.paymentMethodService.remove(user);
  }

  @Post("retry")
  @ApiOperation({
    summary: "Retry outstanding failed weekly subscription payments",
  })
  retry(@User() user: UserEntity) {
    return this.paymentMethodService.retryFailed(user);
  }
}
