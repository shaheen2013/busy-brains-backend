import { IsBoolean, IsEnum, IsOptional } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { PlanName } from "../../subscriptions/entities/plan.entity";

export class StartPlanDto {
  @ApiProperty({ enum: PlanName, enumName: "PlanName" })
  @IsEnum(PlanName)
  planName: PlanName;

  @ApiPropertyOptional({
    description:
      "True when the user reached checkout via the NDIS landing page CTA",
  })
  @IsOptional()
  @IsBoolean()
  fromNdis?: boolean;
}
