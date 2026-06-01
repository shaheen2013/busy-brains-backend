/**
 * Mock @clerk/backend before any module is loaded so that UsersService
 * does not attempt real Clerk API calls during tests.
 */
jest.mock("@clerk/backend", () => ({
  createClerkClient: jest.fn().mockReturnValue({
    users: {
      updateUser: jest.fn().mockResolvedValue({}),
      verifyPassword: jest.fn().mockResolvedValue({ verified: true }),
    },
  }),
  verifyToken: jest.fn(),
}));

import request from "supertest";
import { DataSource } from "typeorm";
import { initApp, closeApp, getApp, authHeader } from "./helpers/create-app";
import {
  cleanDatabase,
  seedPlans,
  createUser,
  giveUserTrial,
  createOtp,
} from "./helpers/db";
import { User } from "../src/modules/users/entities/user.entity";
import { VerificationToken } from "../src/modules/users/entities/verification-token.entity";
import { VerificationType } from "../src/modules/users/entities/verification-token.entity";

describe("UsersController (e2e)", () => {
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
  });

  // ---------------------------------------------------------------------------
  // GET /users/me
  // ---------------------------------------------------------------------------

  describe("GET /users/me", () => {
    it("returns 401 without an authorization header", async () => {
      await request(getApp().getHttpServer()).get("/users/me").expect(401);
    });

    it("returns 401 with an invalid token", async () => {
      await request(getApp().getHttpServer())
        .get("/users/me")
        .set("Authorization", "Bearer invalid-token")
        .expect(401);
    });

    it("returns 200 with user data and activePlan: null when no plan is assigned", async () => {
      const user = await createUser(ds, { id: "user-me-1" });

      const res = await request(getApp().getHttpServer())
        .get("/users/me")
        .set("Authorization", authHeader("user-me-1"))
        .expect(200);

      expect(res.body.id).toBe("user-me-1");
      expect(res.body.email).toBe(user.email);
      expect(res.body.name).toBe(user.name);
      expect(res.body.activePlan).toBeNull();
    });

    it("returns 200 with activePlan.isTrial: true when the user has an active trial", async () => {
      await createUser(ds, { id: "user-trial-1" });
      await giveUserTrial(ds, "user-trial-1");

      const res = await request(getApp().getHttpServer())
        .get("/users/me")
        .set("Authorization", authHeader("user-trial-1"))
        .expect(200);

      expect(res.body.id).toBe("user-trial-1");
      expect(res.body.activePlan).not.toBeNull();
      expect(res.body.activePlan.isTrial).toBe(true);
    });

    it('returns 401 with "The account is deleted!" when the user is soft-deleted', async () => {
      await createUser(ds, { id: "user-deleted-1", isDeleted: true });

      const res = await request(getApp().getHttpServer())
        .get("/users/me")
        .set("Authorization", authHeader("user-deleted-1"))
        .expect(401);

      expect(res.body.message).toBe("The account is deleted!");
    });
  });

  // ---------------------------------------------------------------------------
  // PATCH /users/me
  // ---------------------------------------------------------------------------

  describe("PATCH /users/me", () => {
    it("returns 401 without an authorization header", async () => {
      await request(getApp().getHttpServer())
        .patch("/users/me")
        .send({ name: "New Name" })
        .expect(401);
    });

    it("returns 200 with the updated user when a valid body is sent", async () => {
      await createUser(ds, { id: "user-patch-1", name: "Old Name" });

      const res = await request(getApp().getHttpServer())
        .patch("/users/me")
        .set("Authorization", authHeader("user-patch-1"))
        .send({ name: "New Name" })
        .expect(200);

      expect(res.body.name).toBe("New Name");
    });

    it("persists name change to the database after PATCH", async () => {
      await createUser(ds, { id: "user-patch-db-1", name: "Before" });

      await request(getApp().getHttpServer())
        .patch("/users/me")
        .set("Authorization", authHeader("user-patch-db-1"))
        .send({ name: "After" })
        .expect(200);

      const userRepo = ds.getRepository(User);
      const dbUser = await userRepo.findOne({
        where: { id: "user-patch-db-1" },
      });
      expect(dbUser.name).toBe("After");
    });
  });

  // ---------------------------------------------------------------------------
  // PATCH /users/me/password
  // ---------------------------------------------------------------------------

  describe("PATCH /users/me/password", () => {
    it("returns 401 without an authorization header", async () => {
      await request(getApp().getHttpServer())
        .patch("/users/me/password")
        .send({ newPassword: "newpassword123" })
        .expect(401);
    });

    it("returns 400 when newPassword is missing (ValidationPipe)", async () => {
      await createUser(ds, { id: "user-pwd-1" });

      await request(getApp().getHttpServer())
        .patch("/users/me/password")
        .set("Authorization", authHeader("user-pwd-1"))
        .send({})
        .expect(400);
    });

    it("returns 400 when newPassword is shorter than 8 characters (ValidationPipe)", async () => {
      await createUser(ds, { id: "user-pwd-short-1" });

      await request(getApp().getHttpServer())
        .patch("/users/me/password")
        .set("Authorization", authHeader("user-pwd-short-1"))
        .send({ newPassword: "short" })
        .expect(400);
    });

    it("succeeds when the user has no existing password and only newPassword is provided", async () => {
      await createUser(ds, { id: "user-pwd-new-1", hasPassword: false });

      // The Clerk mock resolves updateUser without error so the service should succeed
      await request(getApp().getHttpServer())
        .patch("/users/me/password")
        .set("Authorization", authHeader("user-pwd-new-1"))
        .send({ newPassword: "newpassword123" })
        .expect(200);
    });
  });

  // ---------------------------------------------------------------------------
  // POST /users/me/request-deletion
  // ---------------------------------------------------------------------------

  describe("POST /users/me/request-deletion", () => {
    it("returns 401 without an authorization header", async () => {
      await request(getApp().getHttpServer())
        .post("/users/me/request-deletion")
        .expect(401);
    });

    it('returns 200 with { message: "OTP sent to email" }', async () => {
      await createUser(ds, { id: "user-req-del-1" });

      const res = await request(getApp().getHttpServer())
        .post("/users/me/request-deletion")
        .set("Authorization", authHeader("user-req-del-1"))
        .expect(201);

      expect(res.body.message).toBe("OTP sent to email");
    });

    it("creates a VerificationToken row in the database", async () => {
      await createUser(ds, { id: "user-req-del-db-1" });

      await request(getApp().getHttpServer())
        .post("/users/me/request-deletion")
        .set("Authorization", authHeader("user-req-del-db-1"))
        .expect(201);

      const tokenRepo = ds.getRepository(VerificationToken);
      const token = await tokenRepo.findOne({
        where: {
          userId: "user-req-del-db-1",
          type: VerificationType.ACCOUNT_DELETION,
          isUsed: false,
        },
      });
      expect(token).not.toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // DELETE /users/me
  // ---------------------------------------------------------------------------

  describe("DELETE /users/me", () => {
    it("returns 401 without an authorization header", async () => {
      await request(getApp().getHttpServer())
        .delete("/users/me")
        .send({ otp: "123456" })
        .expect(401);
    });

    it("returns 400 when the OTP is wrong", async () => {
      await createUser(ds, { id: "user-del-wrong-otp-1" });
      await createOtp(
        ds,
        "user-del-wrong-otp-1",
        VerificationType.ACCOUNT_DELETION,
      );

      await request(getApp().getHttpServer())
        .delete("/users/me")
        .set("Authorization", authHeader("user-del-wrong-otp-1"))
        .send({ otp: "000000" })
        .expect(400);
    });

    it('returns 200 with { message: "Account deleted successfully" } when OTP is correct', async () => {
      await createUser(ds, { id: "user-del-ok-1" });
      const otp = await createOtp(
        ds,
        "user-del-ok-1",
        VerificationType.ACCOUNT_DELETION,
      );

      const res = await request(getApp().getHttpServer())
        .delete("/users/me")
        .set("Authorization", authHeader("user-del-ok-1"))
        .send({ otp })
        .expect(200);

      expect(res.body.message).toBe("Account deleted successfully");
    });

    it("sets user.isDeleted = true in the database after successful deletion", async () => {
      await createUser(ds, { id: "user-del-db-1", isDeleted: false });
      const otp = await createOtp(
        ds,
        "user-del-db-1",
        VerificationType.ACCOUNT_DELETION,
      );

      await request(getApp().getHttpServer())
        .delete("/users/me")
        .set("Authorization", authHeader("user-del-db-1"))
        .send({ otp })
        .expect(200);

      const userRepo = ds.getRepository(User);
      const dbUser = await userRepo.findOne({ where: { id: "user-del-db-1" } });
      expect(dbUser.isDeleted).toBe(true);
    });
  });
});
