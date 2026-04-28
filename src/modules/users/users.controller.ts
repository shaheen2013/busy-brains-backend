import { Controller, Get, Patch, Body } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { User } from "../auth/decorators/user.decorator";
import { User as UserEntity } from "./entities/user.entity";
import { UsersService } from "./users.service";
import { UpdateUserDto } from "./dtos/update-user.dto";
import { UpdatePasswordDto } from "./dtos/update-password.dto";

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

  @Patch("me")
  @ApiOperation({
    summary: "Update the currently authenticated user profile",
    description: "Update user profile information. Email cannot be changed.",
  })
  updateMe(@User() user: UserEntity, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.updateUser(user.id, updateUserDto);
  }

  @Patch("me/password")
  @ApiOperation({
    summary: "Update the currently authenticated user password",
    description:
      "Change user password in Clerk. Password must be at least 8 characters.",
  })
  updatePassword(
    @User() user: UserEntity,
    @Body() updatePasswordDto: UpdatePasswordDto,
  ) {
    return this.usersService.updatePassword(user.id, updatePasswordDto);
  }
}
