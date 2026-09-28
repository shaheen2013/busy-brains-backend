import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class ExchangeSsoDto {
  @ApiProperty({ description: "Single-use SSO token/demo code from the HR portal" })
  @IsString()
  @IsNotEmpty()
  token: string;
}
