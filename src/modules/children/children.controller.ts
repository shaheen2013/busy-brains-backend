import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ChildrenService } from "./children.service";
import { CreateChildDto } from "./dto/create-child.dto";
import { UpdateChildDto } from "./dto/update-child.dto";
import { User } from "../auth/decorators/user.decorator";
import { User as UserEntity } from "../users/entities/user.entity";
import { DeleteChildDto } from "./dto/delete-child.dto";

@ApiTags("Children")
@ApiBearerAuth("Clerk-Bearer")
@Controller("children")
export class ChildrenController {
  constructor(private readonly childrenService: ChildrenService) {}

  @Get()
  @ApiOperation({ summary: "List all children for the authenticated user" })
  findAll(@User() user: UserEntity) {
    return this.childrenService.findAll(user.id);
  }

  @Post()
  @ApiOperation({
    summary: "Create a child profile",
    description:
      "Trial allows 1 child. Paid plan allows up to plan's maxChildren. Trial children count towards the paid limit.",
  })
  create(@User() user: UserEntity, @Body() dto: CreateChildDto) {
    return this.childrenService.create(user.id, dto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a child profile" })
  update(
    @User() user: UserEntity,
    @Param("id") id: string,
    @Body() dto: UpdateChildDto,
  ) {
    return this.childrenService.update(user.id, id, dto);
  }

  @Post(":id/profile-image")
  @ApiOperation({ summary: "Upload a profile image for a child" })
  @UseInterceptors(
    FileInterceptor("profileImage", {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_, file, cb) => {
        if (!file.mimetype.match(/^image\/(jpeg|jpg|png|webp|gif)$/)) {
          return cb(new Error("Only image files are allowed"), false);
        }
        cb(null, true);
      },
    }),
  )
  uploadProfileImage(
    @User() user: UserEntity,
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.childrenService.uploadProfileImage(user.id, id, file);
  }

  @Delete(":id/profile-image")
  @ApiOperation({ summary: "Remove the profile image of a child" })
  removeProfileImage(@User() user: UserEntity, @Param("id") id: string) {
    return this.childrenService.removeProfileImage(user.id, id);
  }

  @Delete(":id")
  @ApiOperation({
    summary: "Delete a child profile",
  })
  delete(
    @User() user: UserEntity,
    @Param("id") id: string,
    @Body() dto: DeleteChildDto,
  ) {
    return this.childrenService.delete(user.id, id, dto.otp);
  }

  @Post(":id/request-deletion")
  @ApiOperation({
    summary: "Request deletion of a child profile",
  })
  requestDeletion(@User() user: UserEntity, @Param("id") id: string) {
    return this.childrenService.requestDeletion(user.id, id);
  }
}
