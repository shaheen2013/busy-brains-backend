import {
  Controller,
  Get,
  Patch,
  Body,
  UploadedFile,
  UseInterceptors,
  Post,
  Delete,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiConsumes,
  ApiBody,
} from "@nestjs/swagger";
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
  @ApiOperation({ summary: "Update the currently authenticated user profile" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        name: { type: "string", example: "John Doe" },
        phoneNumber: { type: "string", example: "+1234567890" },
        country: { type: "string", example: "US" },
        state: { type: "string", example: "California" },
        timezone: { type: "string", example: "America/Los_Angeles" },
        age: { type: "integer", example: 30 },
        zipcode: { type: "string", example: "90001" },
        profileImage: {
          type: "string",
          format: "binary",
          description: "Profile picture (JPG, JPEG, PNG — max 2MB)",
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor("profileImage", {
      limits: { fileSize: 2 * 1024 * 1024 },
      fileFilter: (_, file, cb) => {
        if (!file.mimetype.match(/^image\/(jpeg|jpg|png|webp)$/)) {
          return cb(new Error("Only image files are allowed"), false);
        }
        cb(null, true);
      },
    }),
  )
  updateMe(
    @User() user: UserEntity,
    @Body() updateUserDto: UpdateUserDto,
    @UploadedFile() profileImage?: Express.Multer.File,
  ) {
    return this.usersService.updateUser(user.id, updateUserDto, profileImage);
  }

  @Patch("me/password")
  @ApiOperation({ summary: "Update the currently authenticated user password" })
  updatePassword(
    @User() user: UserEntity,
    @Body() updatePasswordDto: UpdatePasswordDto,
  ) {
    return this.usersService.updatePassword(user.id, updatePasswordDto);
  }

  @Post("me/request-deletion")
  @ApiOperation({ summary: "Request account deletion (sends OTP to email)" })
  requestDeletion(@User() user: UserEntity) {
    return this.usersService.requestDeletion(user.id);
  }

  @Delete("me")
  @ApiOperation({ summary: "Delete account using OTP" })
  deleteAccount(@User() user: UserEntity, @Body("otp") otp: string) {
    return this.usersService.deleteAccount(user.id, otp);
  }
}
