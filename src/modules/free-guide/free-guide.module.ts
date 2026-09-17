import { Module } from "@nestjs/common";
import { KitModule } from "../kit/kit.module";
import { FreeGuideController } from "./free-guide.controller";
import { FreeGuideService } from "./free-guide.service";

@Module({
  imports: [KitModule],
  controllers: [FreeGuideController],
  providers: [FreeGuideService],
})
export class FreeGuideModule {}
