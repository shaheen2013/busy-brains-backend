import { IsEnum } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { PlanName } from "../../subscriptions/entities/plan.entity";

export class StartPlanDto {
  @ApiProperty({ enum: PlanName, enumName: "PlanName" })
  @IsEnum(PlanName)
  planName: PlanName;
}
