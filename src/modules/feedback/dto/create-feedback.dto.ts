import { ApiProperty } from "@nestjs/swagger";
import { IsObject } from "class-validator";

export class CreateFeedbackDto {
  @ApiProperty({
    type: Object,
    description: "Arbitrary JSON feedback payload for the child",
  })
  @IsObject()
  feedback: Record<string, unknown>;
}
