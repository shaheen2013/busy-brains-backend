import { IsEnum, IsOptional } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { WeeklyPlanTier } from "../../subscriptions/entities/weekly-plan.entity";

export class PayoffWeeklySubscriptionDto {
  @ApiPropertyOptional({ enum: WeeklyPlanTier, enumName: "WeeklyPlanTier" })
  @IsOptional()
  @IsEnum(WeeklyPlanTier)
  targetTier?: WeeklyPlanTier;
}
