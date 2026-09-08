import { IsBoolean, IsEnum, IsOptional } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { WeeklyPlanTier } from "../../subscriptions/entities/weekly-plan.entity";

export class StartWeeklySubscriptionDto {
  @ApiProperty({ enum: WeeklyPlanTier, enumName: "WeeklyPlanTier" })
  @IsEnum(WeeklyPlanTier)
  tier: WeeklyPlanTier;

  @ApiPropertyOptional({
    description:
      "True when the user reached checkout via the NDIS landing page CTA",
  })
  @IsOptional()
  @IsBoolean()
  fromNdis?: boolean;
}
