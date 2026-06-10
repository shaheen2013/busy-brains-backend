import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { User } from "../users/entities/user.entity";
import { PaymentService } from "../payment/payment.service";
import { KitService } from "../kit/kit.service";
import { AppConfig } from "../../config/app.config";

interface ClerkEmailAddress {
  id: string;
  email_address: string;
}

interface ClerkPhoneNumber {
  phone_number: string;
}

interface ClerkSignInMethod {
  strategy: string;
}

interface ClerkUserPayload {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email_addresses: ClerkEmailAddress[];
  primary_email_address_id: string | null;
  phone_numbers: ClerkPhoneNumber[];
  password_enabled?: boolean;
  sign_in_methods?: ClerkSignInMethod[];
}

interface ClerkUserEvent {
  type: string;
  data: ClerkUserPayload;
}

@Injectable()
export class ClerkWebhooksService {
  private logger = new Logger(ClerkWebhooksService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private paymentService: PaymentService,
    private kitService: KitService,
    private configService: ConfigService<AppConfig>,
  ) {}

  async handleUserCreated(event: ClerkUserEvent) {
    const user = this.mapClerkPayloadToUser(event.data);
    if (!user) return;

    await this.userRepository.upsert(user, ["id"]);
    this.logger.log(`User upserted: ${event.data.id}`);

    try {
      await this.kitService.subscribeToSignupSequence(event.data.id);
    } catch (error: any) {
      this.logger.error(
        `Failed to subscribe user ${event.data.id} to Kit signup sequence: ${error.message}`,
      );
    }

    const startTrialOnSignup = this.configService.get(
      "features.startTrialOnSignup",
      {
        infer: true,
      },
    );

    if (startTrialOnSignup) {
      try {
        const savedUser = await this.userRepository.findOne({
          where: { id: event.data.id },
        });
        if (savedUser) {
          await this.paymentService.startTrial(savedUser);
          this.logger.log(`Trial started for user: ${event.data.id}`);
        }
      } catch (error: any) {
        this.logger.error(
          `Failed to start trial for user ${event.data.id}: ${error.message}`,
        );
      }
    }
  }

  async handleUserUpdated(event: ClerkUserEvent) {
    const user = this.mapClerkPayloadToUser(event.data);
    if (!user) return;

    // Only sync Clerk-owned fields. phoneNumber and other profile fields
    // (country, state, timezone, age, zipcode) are written by PATCH /users/me
    // and must not be overwritten here — Clerk fires user.updated each time we
    // call clerkClient.users.updateUser(), causing a null-overwrite race.
    await this.userRepository.update(
      { id: user.id },
      { name: user.name, email: user.email, hasPassword: user.hasPassword },
    );
    this.logger.log(`User updated: ${event.data.id}`);
  }

  async handleUserDeleted(event: ClerkUserEvent) {
    const { id } = event.data;

    await this.userRepository.delete({ id: id });
    this.logger.log(`User deleted: ${id}`);
  }

  private mapClerkPayloadToUser(
    payload: ClerkUserPayload,
  ): Pick<
    User,
    "id" | "name" | "email" | "phoneNumber" | "hasPassword"
  > | null {
    const primaryEmail =
      payload.email_addresses.find(
        (e) => e.id === payload.primary_email_address_id,
      )?.email_address ?? payload.email_addresses[0]?.email_address;

    if (!primaryEmail) {
      this.logger.warn(
        `Skipping user ${payload.id}: no email address on record`,
      );
      return null;
    }

    const name =
      [payload.first_name, payload.last_name]
        .filter(Boolean)
        .join(" ")
        .trim() || primaryEmail.split("@")[0];

    const hasPassword =
      payload.password_enabled === true ||
      (payload.sign_in_methods?.some((m) => m.strategy === "password") ??
        false);

    return {
      id: payload.id,
      name,
      email: primaryEmail,
      phoneNumber: payload.phone_numbers?.[0]?.phone_number ?? null,
      hasPassword,
    };
  }
}
