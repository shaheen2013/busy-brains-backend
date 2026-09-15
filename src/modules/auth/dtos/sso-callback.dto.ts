import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class SsoCallbackDto {
  @ApiPropertyOptional({
    description: "Access token provided by the SSO portal",
    example: "a8f9c2d1e0b3...",
  })
  @IsOptional()
  @IsString()
  access_token?: string;

  @ApiPropertyOptional({
    description: "Alternative token field provided by some SSO redirects",
    example: "a8f9c2d1e0b3...",
  })
  @IsOptional()
  @IsString()
  token?: string;
}
