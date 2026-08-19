import { IsEnum, IsOptional, IsString } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { WeeklyPlanTier } from "../../subscriptions/entities/weekly-plan.entity";

export class StartWeeklySubscriptionDto {
  @ApiProperty({ enum: WeeklyPlanTier, enumName: "WeeklyPlanTier" })
  @IsEnum(WeeklyPlanTier)
  tier: WeeklyPlanTier;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paymentMethodId?: string;
}
