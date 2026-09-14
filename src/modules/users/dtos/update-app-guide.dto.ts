import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsObject } from "class-validator";

export class UpdateAppGuideDto {
  @ApiProperty({
    description:
      "Key-value pairs to merge into the user's stored app guide data. New keys are added, existing keys are updated.",
    type: Object,
    example: { onboardingStep: 3, seenWelcomeModal: true },
  })
  @IsObject()
  @IsNotEmpty()
  data: Record<string, unknown>;
}
