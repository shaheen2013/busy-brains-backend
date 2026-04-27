import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { User } from "../auth/decorators/user.decorator";
import { User as UserEntity } from "./entities/user.entity";

@ApiTags("Users")
@ApiBearerAuth("Clerk-Bearer")
@Controller("users")
export class UsersController {
  @Get("me")
  @ApiOperation({ summary: "Get the currently authenticated user" })
  getMe(@User() user: UserEntity): UserEntity {
    return user;
  }
}
