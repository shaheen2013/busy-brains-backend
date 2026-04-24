import { Controller, Post, Body, Req, HttpCode } from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBody, ApiResponse } from "@nestjs/swagger";
import type { Request } from "express";
import { WebhooksService } from "./webhooks.service";

@ApiTags("Webhooks")
@Controller("webhooks/clerk")
export class ClerkWebhookController {
  constructor(private webhooksService: WebhooksService) {}

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
  handleClerkWebhook(
    @Req() _request: RawBodyRequest<Request>,
    @Body() body: unknown,
  ) {
    const eventType = (body as { type?: unknown }).type as string;

    switch (eventType) {
      case "user.created":
        this.webhooksService.handleClerkUserCreated(body);
        break;
      case "user.updated":
        this.webhooksService.handleClerkUserUpdated(body);
        break;
      case "user.deleted":
        this.webhooksService.handleClerkUserDeleted(body);
        break;
      default:
        break;
    }

    return { received: true };
  }
}
