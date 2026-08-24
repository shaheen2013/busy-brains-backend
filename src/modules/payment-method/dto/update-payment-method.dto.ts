import { IsNotEmpty, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class UpdatePaymentMethodDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  paymentMethodId: string;
}
