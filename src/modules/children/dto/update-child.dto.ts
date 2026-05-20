import { PartialType } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString } from "class-validator";
import { CreateChildDto } from "./create-child.dto";

export class UpdateChildDto extends PartialType(CreateChildDto) {
  @IsOptional()
  @IsIn(["avatar", "prebuilt", "image"])
  avatar_type?: "avatar" | "prebuilt" | "image";

  @IsOptional()
  @IsString()
  prebuilt_buddy?: string | null;
}
