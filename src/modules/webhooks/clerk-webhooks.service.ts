import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { User } from "../users/entities/user.entity";
import { Child } from "../children/entities/child.entity";
import { UserPlan } from "../subscriptions/entities/user-plan.entity";
import { PaymentHistory } from "../subscriptions/entities/payment-history.entity";
import { WeeklySubscription } from "../subscriptions/entities/weekly-subscription.entity";
import { VerificationToken } from "../users/entities/verification-token.entity";
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

    const existingByEmail = await this.userRepository.findOne({
      where: { email: user.email },
    });

    if (existingByEmail && existingByEmail.id !== user.id) {
      // The user deleted their Clerk account and signed back up with the
      // same email, so Clerk assigned a new id. Re-link the existing row
      // (and its FK-owned data) to the new id instead of upserting on id,
      // which would otherwise throw on the unique email constraint and
      // leave the DB pointing at a Clerk id that no longer exists.
      await this.relinkUserToNewClerkId(existingByEmail.id, user);
      this.logger.log(
        `Re-linked existing user ${existingByEmail.id} to new Clerk id ${user.id} (email: ${user.email})`,
      );
      return;
    }

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

    // Soft delete, not hard delete: children/user_plans/payment_history/
    // weekly_subscriptions reference this row via NO ACTION foreign keys,
    // so a hard delete throws for any user with real data. Soft-deleting
    // also keeps the row (and its email) around so handleUserCreated can
    // re-link it if the user signs back up under a new Clerk id.
    await this.userRepository.update({ id }, { isDeleted: true });
    this.logger.log(`User soft-deleted: ${id}`);
  }

  private async relinkUserToNewClerkId(
    oldId: string,
    newUser: Pick<
      User,
      "id" | "name" | "email" | "phoneNumber" | "hasPassword"
    >,
  ): Promise<void> {
    await this.userRepository.manager.transaction(async (manager) => {
      const oldUser = await manager.findOne(User, { where: { id: oldId } });
      if (!oldUser) return;

      const newId = newUser.id;

      // Free up the unique email constraint before inserting the new row.
      await manager.update(
        User,
        { id: oldId },
        { email: `__migrated__${oldId}__${oldUser.email}` },
      );

      await manager.insert(User, {
        ...oldUser,
        id: newId,
        name: newUser.name,
        email: newUser.email,
        phoneNumber: newUser.phoneNumber,
        hasPassword: newUser.hasPassword,
        isDeleted: false,
      });

      await manager.update(Child, { userId: oldId }, { userId: newId });
      await manager.update(UserPlan, { userId: oldId }, { userId: newId });
      await manager.update(
        PaymentHistory,
        { userId: oldId },
        { userId: newId },
      );
      await manager.update(
        WeeklySubscription,
        { userId: oldId },
        { userId: newId },
      );
      await manager.update(
        VerificationToken,
        { userId: oldId },
        { userId: newId },
      );

      await manager.delete(User, { id: oldId });
    });
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
