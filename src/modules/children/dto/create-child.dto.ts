import { ApiProperty } from "@nestjs/swagger";
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class CreateChildDto {
  @ApiProperty({ maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;

  @ApiProperty({ minimum: 1, maximum: 18 })
  @IsInt()
  @Min(1)
  @Max(18)
  age: number;

  @ApiProperty({ enum: ["male", "female", "nonBinary", "preferNotToSay"] })
  @IsIn(["male", "female", "nonBinary", "preferNotToSay"])
  gender: string;
}
