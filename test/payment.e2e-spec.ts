jest.mock("stripe", () => {
  const mockStripeInstance = {
    customers: { create: jest.fn().mockResolvedValue({ id: "cus_test_123" }) },
    checkout: {
      sessions: {
        create: jest.fn().mockResolvedValue({
          id: "cs_test_123",
          url: "https://checkout.stripe.com/test",
        }),
      },
    },
    invoices: {
      retrieve: jest.fn().mockResolvedValue({
        invoice_pdf: "https://invoice.pdf",
        payment_intent: "pi_test_123",
      }),
    },
  };
  return jest.fn().mockImplementation(() => mockStripeInstance);
});

import request from "supertest";
import { DataSource } from "typeorm";
import { initApp, closeApp, getApp, authHeader } from "./helpers/create-app";
import {
  cleanDatabase,
  seedPlans,
  createUser,
  giveUserTrial,
  giveUserPaidPlan,
} from "./helpers/db";
import { UserPlan } from "../src/modules/subscriptions/entities/user-plan.entity";
import { PlanName } from "../src/modules/subscriptions/entities/plan.entity";

describe("Payment (e2e)", () => {
  let ds: DataSource;

  beforeAll(async () => {
    ({ dataSource: ds } = await initApp());
    await seedPlans(ds);
  });

  afterAll(async () => {
    await closeApp();
  });

  beforeEach(async () => {
    await cleanDatabase(ds);
    await seedPlans(ds);
    jest.clearAllMocks();
  });

  // ─── POST /payment/start-trial ────────────────────────────────────────────────

  describe("POST /payment/start-trial", () => {
    it("returns 401 without auth", async () => {
      await request(getApp().getHttpServer())
        .post("/payment/start-trial")
        .expect(401);
    });

    it("returns 201 and creates UserPlan with isTrial:true in DB", async () => {
      const user = await createUser(ds);

      const res = await request(getApp().getHttpServer())
        .post("/payment/start-trial")
        .set("Authorization", authHeader(user.id))
        .expect(201);

      expect(res.body.isTrial).toBe(true);
      expect(res.body.isActive).toBe(true);

      const userPlan = await ds.getRepository(UserPlan).findOne({
        where: { userId: user.id },
      });
      expect(userPlan).not.toBeNull();
      expect(userPlan.isTrial).toBe(true);
      expect(userPlan.isActive).toBe(true);
      expect(userPlan.trialEndsAt).not.toBeNull();
    });

    it("returns 409 ConflictException when user already has an active trial", async () => {
      const user = await createUser(ds);
      await giveUserTrial(ds, user.id);

      const res = await request(getApp().getHttpServer())
        .post("/payment/start-trial")
        .set("Authorization", authHeader(user.id))
        .expect(409);

      expect(res.body.message).toBeDefined();
    });

    it("returns 409 when user already has an active paid plan", async () => {
      const user = await createUser(ds);
      await giveUserPaidPlan(ds, user.id, PlanName.SOLO_EXPLORER);

      await request(getApp().getHttpServer())
        .post("/payment/start-trial")
        .set("Authorization", authHeader(user.id))
        .expect(409);
    });
  });

  // ─── POST /payment/start-plan ─────────────────────────────────────────────────

  describe("POST /payment/start-plan", () => {
    it("returns 401 without auth", async () => {
      await request(getApp().getHttpServer())
        .post("/payment/start-plan")
        .send({ planName: "SOLO_EXPLORER" })
        .expect(401);
    });

    it("returns 400 when planName is missing", async () => {
      const user = await createUser(ds);

      await request(getApp().getHttpServer())
        .post("/payment/start-plan")
        .set("Authorization", authHeader(user.id))
        .send({})
        .expect(400);
    });

    it("returns 400 when planName is invalid", async () => {
      const user = await createUser(ds);

      await request(getApp().getHttpServer())
        .post("/payment/start-plan")
        .set("Authorization", authHeader(user.id))
        .send({ planName: "INVALID_PLAN" })
        .expect(400);
    });

    it("returns 409 when user already has an active paid plan", async () => {
      const user = await createUser(ds);
      await giveUserPaidPlan(ds, user.id, PlanName.SOLO_EXPLORER);

      await request(getApp().getHttpServer())
        .post("/payment/start-plan")
        .set("Authorization", authHeader(user.id))
        .send({ planName: PlanName.FAMILY_PACK })
        .expect(409);
    });

    it("returns 200 with sessionId and url when user has active trial", async () => {
      const user = await createUser(ds);
      await giveUserTrial(ds, user.id);

      const res = await request(getApp().getHttpServer())
        .post("/payment/start-plan")
        .set("Authorization", authHeader(user.id))
        .send({ planName: PlanName.SOLO_EXPLORER })
        .expect(201);

      expect(res.body.sessionId).toBe("cs_test_123");
      expect(res.body.url).toBe("https://checkout.stripe.com/test");
    });

    it("returns 200 with sessionId and url for FAMILY_PACK when user has trial", async () => {
      const user = await createUser(ds);
      await giveUserTrial(ds, user.id);

      const res = await request(getApp().getHttpServer())
        .post("/payment/start-plan")
        .set("Authorization", authHeader(user.id))
        .send({ planName: PlanName.FAMILY_PACK })
        .expect(201);

      expect(res.body.sessionId).toBe("cs_test_123");
      expect(res.body.url).toBeDefined();
    });

    it("returns 200 with sessionId and url for new user with no plan", async () => {
      const user = await createUser(ds);

      const res = await request(getApp().getHttpServer())
        .post("/payment/start-plan")
        .set("Authorization", authHeader(user.id))
        .send({ planName: PlanName.SOLO_EXPLORER })
        .expect(201);

      expect(res.body.sessionId).toBe("cs_test_123");
      expect(res.body.url).toBe("https://checkout.stripe.com/test");
    });
  });

  // ─── POST /payment/upgrade-plan ──────────────────────────────────────────────

  describe("POST /payment/upgrade-plan", () => {
    it("returns 401 without auth", async () => {
      await request(getApp().getHttpServer())
        .post("/payment/upgrade-plan")
        .expect(401);
    });

    it("returns 409 when user has no active plan", async () => {
      const user = await createUser(ds);

      const res = await request(getApp().getHttpServer())
        .post("/payment/upgrade-plan")
        .set("Authorization", authHeader(user.id))
        .expect(409);

      expect(res.body.message).toBeDefined();
    });

    it("returns 409 when user is on trial (not eligible for upgrade)", async () => {
      const user = await createUser(ds);
      await giveUserTrial(ds, user.id);

      const res = await request(getApp().getHttpServer())
        .post("/payment/upgrade-plan")
        .set("Authorization", authHeader(user.id))
        .expect(409);

      expect(res.body.message).toBeDefined();
    });

    it("returns 409 when user is already on FAMILY_PACK (not SOLO_EXPLORER)", async () => {
      const user = await createUser(ds);
      await giveUserPaidPlan(ds, user.id, PlanName.FAMILY_PACK);

      await request(getApp().getHttpServer())
        .post("/payment/upgrade-plan")
        .set("Authorization", authHeader(user.id))
        .expect(409);
    });

    it("returns 200 with sessionId and url when user is on SOLO_EXPLORER paid plan", async () => {
      const user = await createUser(ds);
      await giveUserPaidPlan(ds, user.id, PlanName.SOLO_EXPLORER);

      const res = await request(getApp().getHttpServer())
        .post("/payment/upgrade-plan")
        .set("Authorization", authHeader(user.id))
        .expect(201);

      expect(res.body.sessionId).toBe("cs_test_123");
      expect(res.body.url).toBe("https://checkout.stripe.com/test");
    });
  });

  // ─── GET /payment/history ─────────────────────────────────────────────────────

  describe("GET /payment/history", () => {
    it("returns 401 without auth", async () => {
      await request(getApp().getHttpServer())
        .get("/payment/history")
        .expect(401);
    });

    it("returns 200 with empty array when user has no payment history", async () => {
      const user = await createUser(ds);

      const res = await request(getApp().getHttpServer())
        .get("/payment/history")
        .set("Authorization", authHeader(user.id))
        .expect(200);

      expect(res.body).toEqual([]);
    });
  });
});
