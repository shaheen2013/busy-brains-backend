import { Injectable, Logger } from '@nestjs/common';

interface ClerkEvent {
  type: string;
  data?: {
    id?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface StripeEvent {
  type: string;
  data?: {
    object?: {
      id?: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

@Injectable()
export class WebhooksService {
  private logger = new Logger('WebhooksService');

  handleClerkUserCreated(event: unknown) {
    const clerkEvent = event as ClerkEvent;
    this.logger.log('Clerk user.created event received', { userId: clerkEvent.data?.id });
    // TODO: Sync user from Clerk to database
  }

  handleClerkUserUpdated(event: unknown) {
    const clerkEvent = event as ClerkEvent;
    this.logger.log('Clerk user.updated event received', { userId: clerkEvent.data?.id });
    // TODO: Update user in database
  }

  handleClerkUserDeleted(event: unknown) {
    const clerkEvent = event as ClerkEvent;
    this.logger.log('Clerk user.deleted event received', { userId: clerkEvent.data?.id });
    // TODO: Handle user deletion
  }

  handleStripeCheckoutCompleted(event: unknown) {
    const stripeEvent = event as StripeEvent;
    this.logger.log('Stripe checkout.session.completed event received', {
      sessionId: stripeEvent.data?.object?.id,
    });
    // TODO: Process payment and create subscription
  }

  handleStripeInvoicePaymentSucceeded(event: unknown) {
    const stripeEvent = event as StripeEvent;
    this.logger.log('Stripe invoice.payment_succeeded event received', {
      invoiceId: stripeEvent.data?.object?.id,
    });
    // TODO: Update subscription status
  }

  handleStripeInvoicePaymentFailed(event: unknown) {
    const stripeEvent = event as StripeEvent;
    this.logger.log('Stripe invoice.payment_failed event received', {
      invoiceId: stripeEvent.data?.object?.id,
    });
    // TODO: Handle payment failure
  }

  handleStripeCustomerSubscriptionUpdated(event: unknown) {
    const stripeEvent = event as StripeEvent;
    this.logger.log('Stripe customer.subscription.updated event received', {
      subscriptionId: stripeEvent.data?.object?.id,
    });
    // TODO: Update subscription in database
  }
}
