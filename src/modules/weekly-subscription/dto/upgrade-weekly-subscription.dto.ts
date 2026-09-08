import { IsBoolean, IsOptional } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpgradeWeeklySubscriptionDto {
  @ApiPropertyOptional({
    description:
      "True when the user reached checkout via the NDIS landing page CTA",
  })
  @IsOptional()
  @IsBoolean()
  fromNdis?: boolean;
}
