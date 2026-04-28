import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ProgressService } from "./progress.service";
import { SaveScreenDto } from "./dto/save-screen.dto";
import { User } from "../auth/decorators/user.decorator";
import { User as UserEntity } from "../users/entities/user.entity";

@ApiTags("Progress")
@ApiBearerAuth("Clerk-Bearer")
@Controller("children/:childId/progress")
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Post(":moduleNo/:questNo/:screenNo")
  @ApiOperation({ summary: "Save screen progress for a child" })
  saveScreen(
    @User() user: UserEntity,
    @Param("childId") childId: string,
    @Param("moduleNo", ParseIntPipe) moduleNo: number,
    @Param("questNo", ParseIntPipe) questNo: number,
    @Param("screenNo", ParseIntPipe) screenNo: number,
    @Body() dto: SaveScreenDto,
  ) {
    return this.progressService.saveScreen(
      user.id,
      childId,
      moduleNo,
      questNo,
      screenNo,
      dto,
    );
  }

  @Get(":moduleNo/:questNo/:screenNo")
  @ApiOperation({ summary: "Get screen progress for a child" })
  getScreen(
    @User() user: UserEntity,
    @Param("childId") childId: string,
    @Param("moduleNo", ParseIntPipe) moduleNo: number,
    @Param("questNo", ParseIntPipe) questNo: number,
    @Param("screenNo", ParseIntPipe) screenNo: number,
  ) {
    return this.progressService.getScreen(
      user.id,
      childId,
      moduleNo,
      questNo,
      screenNo,
    );
  }
}
