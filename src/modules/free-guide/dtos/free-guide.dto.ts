import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty } from "class-validator";

export class FreeGuideDto {
  @ApiProperty()
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
