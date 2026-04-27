import { Controller, Get, Query } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { ModulesService } from "./modules.service";
import { GetAccessStatusDto } from "./dto/get-access-status.dto";
import { User } from "../auth/decorators/user.decorator";
import { User as UserEntity } from "../users/entities/user.entity";

@ApiTags("Modules")
@ApiBearerAuth("Clerk-Bearer")
@Controller("modules")
export class ModulesController {
  constructor(private readonly modulesService: ModulesService) {}

  @Get("get-access-status")
  @ApiOperation({
    summary: "Get module access status",
    description: `Returns unlock and accessibility status for curriculum modules.

**Query combinations:**
- No params → all ${6} modules
- \`?module=N\` → single module N
- \`?module=N&quest=Q\` → quest Q inside module N
- \`?module=N&quest=Q&screen=S\` → screen S inside quest Q inside module N

**Unlock schedule (from purchasedAt):**
- Module 1: always unlocked (no purchase required)
- Module 2: immediately on purchase (+ 0 days)
- Module 3: +14 days
- Module 4: +28 days
- Module 5: +42 days
- Module 6: +56 days

> \`accessible\` mirrors \`unlocked\` for now and is reserved for future fine-grained access logic.`,
  })
  @ApiOkResponse({
    description: "Access status object keyed by module / quest / screen",
    schema: {
      example: {
        module_1: { unlocked: true, accessible: true, unlockDate: null },
        module_2: {
          unlocked: true,
          accessible: true,
          unlockDate: "2026-04-27T00:00:00.000Z",
        },
        module_3: {
          unlocked: false,
          accessible: false,
          unlockDate: "2026-05-11T00:00:00.000Z",
        },
        module_4: {
          unlocked: false,
          accessible: false,
          unlockDate: "2026-05-25T00:00:00.000Z",
        },
        module_5: {
          unlocked: false,
          accessible: false,
          unlockDate: "2026-06-08T00:00:00.000Z",
        },
        module_6: {
          unlocked: false,
          accessible: false,
          unlockDate: "2026-06-22T00:00:00.000Z",
        },
      },
    },
  })
  getAccessStatus(
    @User() user: UserEntity,
    @Query() query: GetAccessStatusDto,
  ) {
    return this.modulesService.getAccessStatus(
      user.id,
      query.module,
      query.quest,
      query.screen,
    );
  }
}
