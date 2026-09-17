import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppConfig } from "../../config/app.config";
import { KitService } from "../kit/kit.service";

@Injectable()
export class FreeGuideService {
  private readonly logger = new Logger(FreeGuideService.name);

  constructor(
    private readonly kitService: KitService,
    private readonly configService: ConfigService<AppConfig>,
  ) {}

  async requestFreeGuide(email: string): Promise<void> {
    const { freeGuideSequenceId } = this.configService.get("kit", {
      infer: true,
    });

    if (!freeGuideSequenceId) {
      this.logger.warn("KIT_FREE_GUIDE_SEQUENCE_ID not configured — skipping");
      return;
    }

    await this.kitService.subscribeEmailToSequence(email, freeGuideSequenceId);
  }
}
