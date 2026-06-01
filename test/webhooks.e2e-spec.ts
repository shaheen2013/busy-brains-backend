/**
 * Mock svix before any module is loaded so that the ClerkWebhookController
 * does not attempt real signature verification during tests.
 */
const mockVerify = jest.fn();
jest.mock("svix", () => ({
  Webhook: jest.fn().mockImplementation(() => ({ verify: mockVerify })),
}));

/**
 * Mock stripe before any module is loaded so that the StripeWebhookController
 * does not attempt real signature verification or API calls during tests.
 */
const mockConstructEvent = jest.fn();
jest.mock("stripe", () => {
  return jest.fn().mockImplementation(() => ({
    webhooks: { constructEvent: mockConstructEvent },
    customers: { create: jest.fn().mockResolvedValue({ id: "cus_test" }) },
    checkout: {
      sessions: {
        create: jest.fn().mockResolvedValue({
          id: "cs_test",
          url: "https://checkout.stripe.com",
        }),
      },
    },
    invoices: {
      retrieve: jest.fn().mockResolvedValue({
        invoice_pdf: "https://invoice.test/receipt.pdf",
        payment_intent: "pi_test_invoice_123",
      }),
    },
  }));
});

import request from "supertest";
import { DataSource } from "typeorm";
import { initApp, closeApp, getApp } from "./helpers/create-app";
import { cleanDatabase, seedPlans, createUser } from "./helpers/db";
import { User } from "../src/modules/users/entities/user.entity";
import { UserPlan } from "../src/modules/subscriptions/entities/user-plan.entity";

// ---------------------------------------------------------------------------
// Shared Clerk payload builder
// ---------------------------------------------------------------------------

function clerkUserPayload(
  overrides: {
    id?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
  } = {},
) {
  const {
    id = "clerk_user_id",
    first_name = "John",
    last_name = "Doe",
    email = "john@example.com",
  } = overrides;

  return {
    id,
    first_name,
    last_name,
    email_addresses: [{ id: "email_1", email_address: email }],
    primary_email_address_id: "email_1",
    phone_numbers: [],
    password_enabled: false,
  };
}

function sendClerkWebhook(payload: object) {
  return request(getApp().getHttpServer())
    .post("/webhooks/clerk")
    .set("svix-id", "test-id")
    .set("svix-timestamp", "1234567890")
    .set("svix-signature", "v1,test-signature")
    .send(payload);
}

// ---------------------------------------------------------------------------
// Shared Stripe payload / request builder
// ---------------------------------------------------------------------------

function sendStripeWebhook(payload: object) {
  return request(getApp().getHttpServer())
    .post("/webhooks/stripe")
    .set("Content-Type", "application/json")
    .set("stripe-signature", "test-stripe-sig")
    .send(JSON.stringify(payload));
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe("Webhook routes (e2e)", () => {
  let ds: DataSource;

  beforeAll(async () => {
    const result = await initApp();
    ds = result.dataSource;
    await seedPlans(ds);
  });

  afterAll(async () => {
    await closeApp();
  });

  beforeEach(async () => {
    await cleanDatabase(ds);
    await seedPlans(ds);
    mockVerify.mockReset();
    mockConstructEvent.mockReset();
  });

  // -------------------------------------------------------------------------
  // Clerk webhook — POST /webhooks/clerk
  // -------------------------------------------------------------------------

  describe("POST /webhooks/clerk", () => {
    it("returns 400 when svix signature verification fails", async () => {
      mockVerify.mockImplementation(() => {
        throw new Error("Invalid signature");
      });

      await sendClerkWebhook({
        type: "user.created",
        data: clerkUserPayload(),
      }).expect(400);
    });

    it("user.created → 200 and creates a User row in the DB", async () => {
      const data = clerkUserPayload({
        id: "clerk_created_1",
        email: "created1@example.com",
      });
      mockVerify.mockReturnValue({ type: "user.created", data });

      await sendClerkWebhook({ type: "user.created", data }).expect(200);

      const userRepo = ds.getRepository(User);
      const dbUser = await userRepo.findOne({
        where: { id: "clerk_created_1" },
      });
      expect(dbUser).not.toBeNull();
      expect(dbUser.email).toBe("created1@example.com");
      expect(dbUser.name).toBe("John Doe");
    });

    it("user.updated → 200 and updates the User row in the DB", async () => {
      // Pre-seed the user so there is something to update
      await createUser(ds, {
        id: "clerk_updated_1",
        email: "before@example.com",
        name: "Old Name",
      });

      const data = clerkUserPayload({
        id: "clerk_updated_1",
        first_name: "Jane",
        last_name: "Smith",
        email: "after@example.com",
      });
      mockVerify.mockReturnValue({ type: "user.updated", data });

      await sendClerkWebhook({ type: "user.updated", data }).expect(200);

      const userRepo = ds.getRepository(User);
      const dbUser = await userRepo.findOne({
        where: { id: "clerk_updated_1" },
      });
      expect(dbUser).not.toBeNull();
      expect(dbUser.name).toBe("Jane Smith");
      expect(dbUser.email).toBe("after@example.com");
    });

    it("user.deleted → 200 and removes the User row from the DB", async () => {
      await createUser(ds, {
        id: "clerk_deleted_1",
        email: "delete-me@example.com",
      });

      const data = clerkUserPayload({ id: "clerk_deleted_1" });
      mockVerify.mockReturnValue({ type: "user.deleted", data });

      await sendClerkWebhook({ type: "user.deleted", data }).expect(200);

      const userRepo = ds.getRepository(User);
      const dbUser = await userRepo.findOne({
        where: { id: "clerk_deleted_1" },
      });
      expect(dbUser).toBeNull();
    });

    it("unknown event type → 200 { received: true } (gracefully ignored)", async () => {
      mockVerify.mockReturnValue({ type: "session.created", data: {} });

      const res = await sendClerkWebhook({
        type: "session.created",
        data: {},
      }).expect(200);

      expect(res.body).toEqual({ received: true });
    });
  });

  // -------------------------------------------------------------------------
  // Stripe webhook — POST /webhooks/stripe
  // -------------------------------------------------------------------------

  describe("POST /webhooks/stripe", () => {
    it("returns 400 when stripe signature verification fails", async () => {
      mockConstructEvent.mockImplementation(() => {
        throw new Error(
          "No signatures found matching the expected signature for payload",
        );
      });

      await sendStripeWebhook({
        type: "checkout.session.completed",
        data: { object: {} },
      }).expect(400);
    });

    it("checkout.session.completed → 200 { received: true } and creates a UserPlan in the DB", async () => {
      const user = await createUser(ds);

      const stripeEvent = {
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test_123",
            metadata: { userId: user.id, planName: "SOLO_EXPLORER" },
            payment_intent: "pi_test_123",
            amount_total: 4900,
            currency: "aud",
          },
        },
      };
      mockConstructEvent.mockReturnValue(stripeEvent);

      const res = await sendStripeWebhook(stripeEvent).expect(200);
      expect(res.body).toEqual({ received: true });

      const userPlanRepo = ds.getRepository(UserPlan);
      const userPlan = await userPlanRepo.findOne({
        where: { userId: user.id },
      });
      expect(userPlan).not.toBeNull();
      expect(userPlan.isActive).toBe(true);
      expect(userPlan.isTrial).toBe(false);
    });

    it("checkout.session.completed with missing metadata → 200 { received: true }, no UserPlan created", async () => {
      const stripeEvent = {
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_no_meta_456",
            metadata: {},
            payment_intent: "pi_no_meta_456",
            amount_total: 4900,
            currency: "aud",
          },
        },
      };
      mockConstructEvent.mockReturnValue(stripeEvent);

      const res = await sendStripeWebhook(stripeEvent).expect(200);
      expect(res.body).toEqual({ received: true });
    });

    it("payment_intent.succeeded → 200 { received: true }", async () => {
      const stripeEvent = {
        type: "payment_intent.succeeded",
        data: {
          object: {
            id: "pi_succeeded_123",
            amount: 4900,
            currency: "aud",
          },
        },
      };
      mockConstructEvent.mockReturnValue(stripeEvent);

      const res = await sendStripeWebhook(stripeEvent).expect(200);
      expect(res.body).toEqual({ received: true });
    });

    it("payment_intent.payment_failed → 200 { received: true }", async () => {
      const stripeEvent = {
        type: "payment_intent.payment_failed",
        data: {
          object: {
            id: "pi_failed_123",
          },
        },
      };
      mockConstructEvent.mockReturnValue(stripeEvent);

      const res = await sendStripeWebhook(stripeEvent).expect(200);
      expect(res.body).toEqual({ received: true });
    });

    it("invoice.payment_succeeded → 200 { received: true }", async () => {
      const stripeEvent = {
        type: "invoice.payment_succeeded",
        data: {
          object: {
            id: "in_succeeded_123",
            payment_intent: "pi_inv_123",
            amount_paid: 4900,
            currency: "aud",
            invoice_pdf: null,
            hosted_invoice_url: null,
          },
        },
      };
      mockConstructEvent.mockReturnValue(stripeEvent);

      const res = await sendStripeWebhook(stripeEvent).expect(200);
      expect(res.body).toEqual({ received: true });
    });

    it("unknown event type → 200 { received: true } (gracefully ignored)", async () => {
      const stripeEvent = {
        type: "customer.created",
        data: { object: { id: "cus_unknown" } },
      };
      mockConstructEvent.mockReturnValue(stripeEvent);

      const res = await sendStripeWebhook(stripeEvent).expect(200);
      expect(res.body).toEqual({ received: true });
    });
  });
});
