import { PlanName } from "../modules/subscriptions/entities/plan.entity";
import Stripe from "stripe";

type StripeTypes = InstanceType<typeof Stripe>;
type Event = StripeTypes["webhooks"]["constructEvent"];

export type CheckoutSessionCompletedEvent = Event & {
  type: "checkout.session.completed";
  data: {
    object: {
      id: string;
      payment_intent: string | null;
      amount_total: number | null;
      currency: string | null;
      metadata: {
        userId: string;
        planName: PlanName;
        isUpgrade?: string;
      };
      discounts: Array<{
        coupon: string | null;
        promotion_code: string | null;
      }> | null;
    };
  };
};

export type PaymentIntentSucceededEvent = Event & {
  type: "payment_intent.succeeded";
  data: {
    object: {
      id: string;
      amount: number;
      currency: string;
    };
  };
};

export type PaymentIntentPaymentFailedEvent = Event & {
  type: "payment_intent.payment_failed";
  data: {
    object: {
      id: string;
    };
  };
};

export type InvoicePaymentSucceededEvent = Event & {
  type: "invoice.payment_succeeded";
  data: {
    object: {
      id: string;
      payment_intent: string | null;
      amount_paid: number;
      currency: string;
      invoice_pdf: string | null;
      hosted_invoice_url: string | null;
    };
  };
};

export type InvoicePaymentFailedEvent = Event & {
  type: "invoice.payment_failed";
  data: {
    object: {
      id: string;
      payment_intent: string | null;
      amount_due: number;
      currency: string;
    };
  };
};
