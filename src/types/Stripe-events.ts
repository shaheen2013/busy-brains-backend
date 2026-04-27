import { PlanName } from "../modules/subscriptions/entities/plan.entity";

type CheckoutSessionCompletedEvent = {
  type: "checkout.session.completed";
  data: {
    object: {
      id: string;
      amount_total: number;
      currency: string;
      metadata: {
        userId: string;
        planName: PlanName;
      };
    };
  };
};

type InvoicePaymentSucceededEvent = {
  type: "invoice.payment_succeeded";
  data: {
    object: {
      id: string;
      amount_paid: number;
      currency: string;
      metadata: {
        userId: string;
        planName: PlanName;
      };
    };
  };
};

type InvoicePaymentFailedEvent = {
  type: "invoice.payment_failed";
  data: {
    object: {
      id: string;
      amount_paid: number;
      currency: string;
      metadata: {
        userId: string;
        planName: PlanName;
      };
    };
  };
};

export type {
  CheckoutSessionCompletedEvent,
  InvoicePaymentSucceededEvent,
  InvoicePaymentFailedEvent,
};
