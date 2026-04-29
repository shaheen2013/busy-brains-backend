import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ChildrenService } from "./children.service";
import { CreateChildDto } from "./dto/create-child.dto";
import { UpdateChildDto } from "./dto/update-child.dto";
import { User } from "../auth/decorators/user.decorator";
import { User as UserEntity } from "../users/entities/user.entity";

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

  @Delete(":id")
  @ApiOperation({
    summary: "Delete a child profile",
    description: "Deletes a child profile and all associated data (modules, quests, screens, progress)",
  })
  delete(@User() user: UserEntity, @Param("id") id: string) {
    return this.childrenService.delete(user.id, id);
  }
}
