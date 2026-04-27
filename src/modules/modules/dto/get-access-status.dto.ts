import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min, ValidateIf } from "class-validator";
import { MAX_MODULES } from "../modules.constants";

export class GetAccessStatusDto {
  @ApiPropertyOptional({
    description: "Module number (1 – MAX_MODULES). Omit to get all modules.",
    minimum: 1,
    maximum: MAX_MODULES,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_MODULES)
  module?: number;

  @ApiPropertyOptional({
    description: "Quest number within the module. Requires module.",
    minimum: 1,
  })
  @ValidateIf((o: GetAccessStatusDto) => o.quest !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quest?: number;

  @ApiPropertyOptional({
    description: "Screen number within the quest. Requires module + quest.",
    minimum: 1,
  })
  @ValidateIf((o: GetAccessStatusDto) => o.screen !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  screen?: number;
}
