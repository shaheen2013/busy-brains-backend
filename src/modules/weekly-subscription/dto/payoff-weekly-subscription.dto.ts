import { IsBoolean, IsEnum, IsOptional } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { WeeklyPlanTier } from "../../subscriptions/entities/weekly-plan.entity";

export class PayoffWeeklySubscriptionDto {
  @ApiPropertyOptional({ enum: WeeklyPlanTier, enumName: "WeeklyPlanTier" })
  @IsOptional()
  @IsEnum(WeeklyPlanTier)
  targetTier?: WeeklyPlanTier;

  @ApiPropertyOptional({
    description:
      "True when the user reached checkout via the NDIS landing page CTA",
  })
  @IsOptional()
  @IsBoolean()
  fromNdis?: boolean;
}
