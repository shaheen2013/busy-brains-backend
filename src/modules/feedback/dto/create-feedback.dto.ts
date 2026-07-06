import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsObject, IsOptional } from "class-validator";

export class CreateFeedbackDto {
  @ApiProperty({
    type: Object,
    description: "Arbitrary JSON feedback payload for the child",
  })
  @IsObject()
  feedback: Record<string, unknown>;

  @ApiProperty({
    type: Boolean,
    required: false,
    default: false,
    description: "Whether this feedback was submitted by the child (true) or parent (false)",
  })
  @IsOptional()
  @IsBoolean()
  byChild?: boolean;
}
