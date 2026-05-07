import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class DeleteChildDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  otp: string;
}
