import { Controller, Get, Param, ParseArrayPipe, Query } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { DashboardService } from "./dashboard.service";
import { User } from "../auth/decorators/user.decorator";
import { User as UserEntity } from "../users/entities/user.entity";

@ApiTags("Dashboard")
@ApiBearerAuth("Clerk-Bearer")
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get(":childId")
  @ApiOperation({ summary: "Get full dashboard for a child" })
  @ApiQuery({
    name: "include",
    required: false,
    isArray: true,
    enum: ["quest", "screen"],
    description:
      "Include quest_progress and/or screen_progress in the response",
  })
  getDashboard(
    @User() user: UserEntity,
    @Param("childId") childId: string,
    @Query("include", new ParseArrayPipe({ optional: true, separator: "," }))
    include: string[] = [],
  ) {
    return this.dashboardService.getDashboard(user.id, childId, include);
  }
}
