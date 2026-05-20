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

  async notifyModule1Completed(
    userId: string,
    childName: string,
  ): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      this.logger.warn(
        `User ${userId} not found — skipping module 1 completion notification`,
      );
      return;
    }

    // TODO: send Kit email when template is ready
    this.logger.log(
      `[Kit] Module 1 completed — child: "${childName}", parent email: ${user.email}`,
    );

    const { apiKey, module1CompletionSequenceId } = this.configService.get(
      "kit",
      { infer: true },
    );

    if (!apiKey || !module1CompletionSequenceId) {
      this.logger.warn(
        "KIT_API_KEY or KIT_MODULE1_COMPLETION_SEQUENCE_ID not configured — skipping",
      );
      return;
    }

    const response = await fetch(
      `${KIT_API_BASE}/sequences/${module1CompletionSequenceId}/subscribe`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_secret: apiKey,
          email: "mdmarufbinsalim@gmail.com",
          first_name: user.name,

          fields: {
            child_name: childName,
          },
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Kit API error (${response.status}): ${body}`);
    }
  }

  async sendAccountDeletionOtp(userId: string, otp: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      this.logger.warn(
        `User ${userId} not found — skipping account deletion OTP`,
      );
      return;
    }

    const { apiKey, accountDeletionOtpSequenceId } = this.configService.get(
      "kit",
      { infer: true },
    );

    if (!apiKey || !accountDeletionOtpSequenceId) {
      this.logger.warn(
        "KIT_API_KEY or KIT_ACCOUNT_DELETION_OTP_SEQUENCE_ID not configured — skipping",
      );
      return;
    }

    const response = await fetch(
      `${KIT_API_BASE}/sequences/${accountDeletionOtpSequenceId}/subscribe`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_secret: apiKey,
          email: "mdmarufbinsalim@gmail.com",
          first_name: user.name,
          fields: { otp },
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Kit API error (${response.status}): ${body}`);
    }

    this.logger.log(`[Kit] Account deletion OTP sent to ${user.email}`);
  }

  async sendChildDeletionOtp(
    userId: string,
    childName: string,
    otp: string,
  ): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      this.logger.warn(
        `User ${userId} not found — skipping child deletion OTP`,
      );
      return;
    }

    const { apiKey, childDeletionOtpSequenceId } = this.configService.get(
      "kit",
      { infer: true },
    );

    if (!apiKey || !childDeletionOtpSequenceId) {
      this.logger.warn(
        "KIT_API_KEY or KIT_CHILD_DELETION_OTP_SEQUENCE_ID not configured — skipping",
      );
      return;
    }

    const response = await fetch(
      `${KIT_API_BASE}/sequences/${childDeletionOtpSequenceId}/subscribe`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_secret: apiKey,
          email: "mdmarufbinsalim@gmail.com",
          first_name: user.name,
          fields: { otp, child_name: childName },
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Kit API error (${response.status}): ${body}`);
    }

    this.logger.log(
      `[Kit] Child deletion OTP sent to ${user.email} for child "${childName}"`,
    );
  }

  async subscribeToSequence(userId: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      this.logger.warn(`User ${userId} not found — skipping Kit subscription`);
      return;
    }

    const { apiKey, purchaseCompletionSequenceId } = this.configService.get(
      "kit",
      { infer: true },
    );

    if (!purchaseCompletionSequenceId) {
      this.logger.warn(
        "KIT_PURCHASE_COMPLETION_SEQUENCE_ID not configured — skipping",
      );
      return;
    }

    if (!apiKey) {
      this.logger.warn("KIT_API_KEY not configured — skipping");
      return;
    }

    const response = await fetch(
      `${KIT_API_BASE}/sequences/${purchaseCompletionSequenceId}/subscribe`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_secret: apiKey,
          email: "mdmarufbinsalim@gmail.com",
          first_name: user.name,
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Kit API error (${response.status}): ${body}`);
    }

    this.logger.log(
      `Subscribed ${user.email} to Kit sequence ${purchaseCompletionSequenceId}`,
    );
  }
}
