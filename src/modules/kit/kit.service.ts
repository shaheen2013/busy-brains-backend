import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";
import { Repository } from "typeorm";
import { AppConfig } from "../../config/app.config";
import { User } from "../users/entities/user.entity";

const KIT_API_BASE = "https://api.convertkit.com/v3";

@Injectable()
export class KitService {
  private readonly logger = new Logger(KitService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly configService: ConfigService<AppConfig>,
  ) {}

  async subscribeToSequence(userId: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      this.logger.warn(`User ${userId} not found — skipping Kit subscription`);
      return;
    }

    const { apiKey, sequenceId } = this.configService.get("kit", {
      infer: true,
    });

    if (!sequenceId) {
      this.logger.warn("KIT_SEQUENCE_ID not configured — skipping");
      return;
    }

    if (!apiKey) {
      this.logger.warn("KIT_API_KEY not configured — skipping");
      return;
    }

    const firstName = user.name.split(" ")[0];

    const response = await fetch(
      `${KIT_API_BASE}/sequences/${sequenceId}/subscribe`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_secret: apiKey,
          email: user.email,
          first_name: firstName,
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Kit API error (${response.status}): ${body}`);
    }

    this.logger.log(`Subscribed ${user.email} to Kit sequence ${sequenceId}`);
  }
}
