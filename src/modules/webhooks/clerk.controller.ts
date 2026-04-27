import {
  Controller,
  Post,
  Req,
  HttpCode,
  BadRequestException,
} from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBody, ApiResponse } from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";
import { Webhook } from "svix";
import { ClerkWebhooksService } from "./clerk-webhooks.service";

@ApiTags("Webhooks")
@Controller("webhooks/clerk")
export class ClerkWebhookController {
  constructor(
    private clerkWebhooksService: ClerkWebhooksService,
    private configService: ConfigService,
  ) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: "Handle Clerk webhook events" })
  @ApiBody({
    description:
      "Clerk webhook payload (user.created, user.updated, user.deleted)",
    schema: {
      example: {
        type: "user.created",
        data: {
          id: "user_123",
          email_addresses: [{ email_address: "user@example.com" }],
          first_name: "John",
          last_name: "Doe",
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: "Webhook received successfully",
    schema: { example: { received: true } },
  })
  @ApiResponse({
    status: 400,
    description: "Webhook signature verification failed",
  })
  async handleClerkWebhook(@Req() request: RawBodyRequest<Request>) {
    const webhookSecret = this.configService.get<string>("clerk.webhookSecret");

    if (!webhookSecret) {
      throw new BadRequestException("Clerk webhook secret is not configured");
    }

    const wh = new Webhook(webhookSecret);
    let event: ReturnType<Webhook["verify"]>;

    try {
      event = wh.verify(request.rawBody ?? Buffer.from(""), {
        "svix-id": request.headers["svix-id"] as string,
        "svix-timestamp": request.headers["svix-timestamp"] as string,
        "svix-signature": request.headers["svix-signature"] as string,
      });
    } catch {
      throw new BadRequestException("Invalid Clerk webhook signature");
    }

    const body = event as { type: string; data: unknown };

    switch (body.type) {
      case "user.created":
        await this.clerkWebhooksService.handleUserCreated(body as never);
        break;
      case "user.updated":
        await this.clerkWebhooksService.handleUserUpdated(body as never);
        break;
      case "user.deleted":
        await this.clerkWebhooksService.handleUserDeleted(body as never);
        break;
    }

    return { received: true };
  }
}
