import { IsEnum } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { PlanName } from "../../subscriptions/entities/plan.entity";

export class StartTrialDto {
  @ApiProperty({ enum: PlanName, enumName: "PlanName" })
  @IsEnum(PlanName)
  planName: PlanName;
}
