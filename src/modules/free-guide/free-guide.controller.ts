import { Body, Controller, Post } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { Public } from "../auth/decorators/public.decorator";
import { FreeGuideService } from "./free-guide.service";
import { FreeGuideDto } from "./dtos/free-guide.dto";

@ApiTags("Free Guide")
@Controller("free-guide")
export class FreeGuideController {
  constructor(private readonly freeGuideService: FreeGuideService) {}

  @Post()
  @ApiOperation({ summary: "Request the free parent guide by email" })
  @ApiResponse({
    status: 201,
    description: "Guide request received",
  })
  @Public()
  async requestFreeGuide(@Body() freeGuideDto: FreeGuideDto) {
    await this.freeGuideService.requestFreeGuide(freeGuideDto.email);
    return { message: "Free guide request received" };
  }
}
