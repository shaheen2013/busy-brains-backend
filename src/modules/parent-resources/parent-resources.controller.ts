import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ParentResourcesService } from "./parent-resources.service";
import { User } from "../auth/decorators/user.decorator";
import { User as UserEntity } from "../users/entities/user.entity";

@ApiTags("Parent Resources")
@ApiBearerAuth("Clerk-Bearer")
@Controller("parent-resources")
export class ParentResourcesController {
  constructor(private readonly parentResourcesService: ParentResourcesService) {}

  @Get()
  @ApiOperation({
    summary:
      "Get parent resources for modules that are unlocked and completed by at least one child",
  })
  getResources(@User() user: UserEntity) {
    return this.parentResourcesService.getResources(user.id);
  }
}
