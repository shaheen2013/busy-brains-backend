import { PartialType } from "@nestjs/swagger";
import { IsBoolean, IsOptional } from "class-validator";
import { CreateChildDto } from "./create-child.dto";

export class UpdateChildDto extends PartialType(CreateChildDto) {
  @IsOptional()
  @IsBoolean()
  useAvatar?: boolean;
}
