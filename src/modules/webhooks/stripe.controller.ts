import {
  Controller,
  Post,
  Req,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import Stripe from 'stripe';
import { WebhooksService } from './webhooks.service';

@ApiTags('Webhooks')
@Controller('webhooks/stripe')
export class StripeWebhookController {
  private stripe: Stripe.Stripe;

  constructor(
    private webhooksService: WebhooksService,
    private configService: ConfigService,
  ) {
    const secretKey = this.configService.get('stripe.secretKey') as string;
    this.stripe = new Stripe(secretKey);
  }

  @Post()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Handle Stripe webhook events',
    description:
      'Processes Stripe events: checkout.session.completed, invoice.payment_succeeded, invoice.payment_failed, customer.subscription.updated',
  })
  @ApiBody({
    description: 'Stripe webhook payload signed with STRIPE_WEBHOOK_SECRET',
    schema: {
      example: {
        id: 'evt_1234567890',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_1234567890',
            amount_total: 2000,
            currency: 'usd',
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook received and processed',
    schema: { example: { received: true } },
  })
  @ApiResponse({
    status: 400,
    description: 'Webhook signature verification failed',
  })
  handleStripeWebhook(@Req() request: RawBodyRequest<Request>) {
    const signature = request.headers['stripe-signature'] as string;
    const webhookSecret = this.configService.get<string>(
      'stripe.webhookSecret',
    );

    if (!webhookSecret) {
      throw new BadRequestException('Webhook secret is not configured');
    }

    const event = this.stripe.webhooks.constructEvent(
      request.rawBody || Buffer.from(''),
      signature,
      webhookSecret,
    ) as unknown;

    const eventType = (event as { type?: unknown }).type as string;

    switch (eventType) {
      case 'checkout.session.completed':
        this.webhooksService.handleStripeCheckoutCompleted(event);
        break;
      case 'invoice.payment_succeeded':
        this.webhooksService.handleStripeInvoicePaymentSucceeded(event);
        break;
      case 'invoice.payment_failed':
        this.webhooksService.handleStripeInvoicePaymentFailed(event);
        break;
      case 'customer.subscription.updated':
        this.webhooksService.handleStripeCustomerSubscriptionUpdated(event);
        break;
      default:
        break;
    }

    return { received: true };
  }
}
