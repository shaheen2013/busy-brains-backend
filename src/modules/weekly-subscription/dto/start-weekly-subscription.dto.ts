import { IsEnum } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { WeeklyPlanTier } from "../../subscriptions/entities/weekly-plan.entity";

export class StartWeeklySubscriptionDto {
  @ApiProperty({ enum: WeeklyPlanTier, enumName: "WeeklyPlanTier" })
  @IsEnum(WeeklyPlanTier)
  tier: WeeklyPlanTier;
}
