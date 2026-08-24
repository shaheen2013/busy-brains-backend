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
import Stripe from "stripe";
import { StripeWebhooksService } from "./stripe-webhooks.service";
import { Public } from "../auth/decorators/public.decorator";
import { AppConfig } from "../../config/app.config";

@Public()
@ApiTags("Webhooks")
@Controller("webhooks/stripe")
export class StripeWebhookController {
  private stripe: Stripe.Stripe;

  constructor(
    private stripeWebhooksService: StripeWebhooksService,
    private configService: ConfigService<AppConfig>,
  ) {
    const { secretKey } = this.configService.get("stripe", { infer: true });
    if (!secretKey) throw new Error("STRIPE_SECRET_KEY is not configured");
    this.stripe = new Stripe(secretKey);
  }

  @Post()
  @HttpCode(200)
  @ApiOperation({
    summary: "Handle Stripe webhook events",
    description:
      "Processes Stripe events: checkout.session.completed, invoice.payment_succeeded, invoice.payment_failed, customer.subscription.updated",
  })
  @ApiBody({
    description: "Stripe webhook payload signed with STRIPE_WEBHOOK_SECRET",
    schema: {
      example: {
        id: "evt_1234567890",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test_1234567890",
            amount_total: 2000,
            currency: "aud",
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: "Webhook received and processed",
    schema: { example: { received: true } },
  })
  @ApiResponse({
    status: 400,
    description: "Webhook signature verification failed",
  })
  async handleStripeWebhook(@Req() request: RawBodyRequest<Request>) {
    const signature = request.headers["stripe-signature"] as string;
    const { webhookSecret } = this.configService.get("stripe", { infer: true });

    let event: ReturnType<Stripe.Stripe["webhooks"]["constructEvent"]>;

    try {
      event = this.stripe.webhooks.constructEvent(
        request.rawBody ?? Buffer.from(""),
        signature,
        webhookSecret,
      );
    } catch {
      throw new BadRequestException("Invalid Stripe webhook signature");
    }

    switch (event.type) {
      case "checkout.session.completed":
        await this.stripeWebhooksService.handleCheckoutCompleted(event);
        break;
      case "invoice.payment_succeeded":
        await this.stripeWebhooksService.handleInvoicePaymentSucceeded(event);
        break;
      case "invoice.payment_failed":
        await this.stripeWebhooksService.handleInvoicePaymentFailed(event);
        break;
      case "payment_intent.succeeded":
        await this.stripeWebhooksService.handlePaymentIntentSucceeded(event);
        break;
      case "payment_intent.payment_failed":
        await this.stripeWebhooksService.handlePaymentIntentFailed(event);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await this.stripeWebhooksService.handleSubscriptionUpdated(event);
        break;
      case "customer.subscription.deleted":
        await this.stripeWebhooksService.handleSubscriptionDeleted(event);
        break;
      default:
        break;
    }

    return { received: true };
  }
}
