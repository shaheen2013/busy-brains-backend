import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";

export class UpdateAppGuideShownDto {
  @ApiProperty({
    description: "Whether the app guide should be shown to the current user",
    example: false,
  })
  @IsBoolean()
  appGuideShown: boolean;
}
