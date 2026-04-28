import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "../users/entities/user.entity";

interface ClerkEmailAddress {
  id: string;
  email_address: string;
}

interface ClerkPhoneNumber {
  phone_number: string;
}

interface ClerkUserPayload {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email_addresses: ClerkEmailAddress[];
  primary_email_address_id: string | null;
  phone_numbers: ClerkPhoneNumber[];
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
  ) {}

  async handleUserCreated(event: ClerkUserEvent) {
    const user = this.mapClerkPayloadToUser(event.data);
    if (!user) return;

    await this.userRepository.upsert(user, ["id"]);
    this.logger.log(`User upserted: ${event.data.id}`);
  }

  async handleUserUpdated(event: ClerkUserEvent) {
    const user = this.mapClerkPayloadToUser(event.data);
    if (!user) return;

    await this.userRepository.upsert(user, ["id"]);
    this.logger.log(`User updated: ${event.data.id}`);
  }

  async handleUserDeleted(event: ClerkUserEvent) {
    const { id } = event.data;

    await this.userRepository.delete({ id: id });
    this.logger.log(`User deleted: ${id}`);
  }

  private mapClerkPayloadToUser(
    payload: ClerkUserPayload,
  ): Pick<User, "id" | "firstName" | "lastName" | "email" | "phoneNumber"> | null {
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

    const firstName = payload.first_name ?? primaryEmail.split("@")[0];
    const lastName = payload.last_name ?? "";

    return {
      id: payload.id,
      firstName,
      lastName,
      email: primaryEmail,
      phoneNumber: payload.phone_numbers?.[0]?.phone_number ?? null,
    };
  }
}
