import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { User } from "../auth/decorators/user.decorator";
import { User as UserEntity } from "./entities/user.entity";
import { UsersService } from "./users.service";

@ApiTags("Users")
@ApiBearerAuth("Clerk-Bearer")
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("me")
  @ApiOperation({
    summary: "Get the currently authenticated user with active plan",
  })
  getMe(@User() user: UserEntity) {
    return this.usersService.findWithActivePlan(user.id);
  }
}
