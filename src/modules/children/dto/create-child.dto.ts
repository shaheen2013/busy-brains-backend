import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsInt, IsString, Max, Min } from "class-validator";

export class CreateChildDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ minimum: 1, maximum: 18 })
  @IsInt()
  @Min(1)
  @Max(18)
  age: number;

  @ApiProperty({ enum: ["male", "female"] })
  @IsIn(["male", "female"])
  gender: string;
}
