import request from "supertest";
import { DataSource } from "typeorm";
import {
  initApp,
  closeApp,
  getApp,
  authHeader,
  mockS3,
} from "./helpers/create-app";
import {
  cleanDatabase,
  seedPlans,
  createUser,
  giveUserTrial,
  giveUserPaidPlan,
  createOtp,
} from "./helpers/db";
import { Child } from "../src/modules/children/entities/child.entity";
import { VerificationToken } from "../src/modules/users/entities/verification-token.entity";
import { VerificationType } from "../src/modules/users/entities/verification-token.entity";
import { PlanName } from "../src/modules/subscriptions/entities/plan.entity";

describe("Children (e2e)", () => {
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

  // ─── GET /children ───────────────────────────────────────────────────────────

  describe("GET /children", () => {
    it("returns 401 without auth", async () => {
      await request(getApp().getHttpServer()).get("/children").expect(401);
    });

    it("returns 200 with empty array when user has no children", async () => {
      const user = await createUser(ds);

      const res = await request(getApp().getHttpServer())
        .get("/children")
        .set("Authorization", authHeader(user.id))
        .expect(200);

      expect(res.body).toEqual([]);
    });
  });

  // ─── POST /children ───────────────────────────────────────────────────────────

  describe("POST /children", () => {
    it("returns 401 without auth", async () => {
      await request(getApp().getHttpServer())
        .post("/children")
        .send({ name: "Alice", age: 8, gender: "female" })
        .expect(401);
    });

    it("returns 400 when name is missing", async () => {
      const user = await createUser(ds);

      await request(getApp().getHttpServer())
        .post("/children")
        .set("Authorization", authHeader(user.id))
        .send({ age: 8, gender: "female" })
        .expect(400);
    });

    it("returns 400 when age is out of range (99)", async () => {
      const user = await createUser(ds);

      await request(getApp().getHttpServer())
        .post("/children")
        .set("Authorization", authHeader(user.id))
        .send({ name: "Alice", age: 99, gender: "female" })
        .expect(400);
    });

    it("returns 400 when age is below minimum (0)", async () => {
      const user = await createUser(ds);

      await request(getApp().getHttpServer())
        .post("/children")
        .set("Authorization", authHeader(user.id))
        .send({ name: "Alice", age: 0, gender: "female" })
        .expect(400);
    });

    it("returns 400 when gender is invalid", async () => {
      const user = await createUser(ds);

      await request(getApp().getHttpServer())
        .post("/children")
        .set("Authorization", authHeader(user.id))
        .send({ name: "Alice", age: 8, gender: "other" })
        .expect(400);
    });

    it("returns 403 with no active plan", async () => {
      const user = await createUser(ds);

      const res = await request(getApp().getHttpServer())
        .post("/children")
        .set("Authorization", authHeader(user.id))
        .send({ name: "Alice", age: 8, gender: "female" })
        .expect(403);

      expect(res.body.message).toBe("An active plan or trial is required");
    });

    it("returns 201 and creates child in DB when user has trial", async () => {
      const user = await createUser(ds);
      await giveUserTrial(ds, user.id);

      const res = await request(getApp().getHttpServer())
        .post("/children")
        .set("Authorization", authHeader(user.id))
        .send({ name: "Alice", age: 8, gender: "female" })
        .expect(201);

      expect(res.body).toMatchObject({
        name: "Alice",
        age: 8,
        gender: "female",
      });
      expect(res.body.id).toBeDefined();

      const childInDb = await ds
        .getRepository(Child)
        .findOneBy({ id: res.body.id });
      expect(childInDb).not.toBeNull();
      expect(childInDb.name).toBe("Alice");
      expect(childInDb.userId).toBe(user.id);
    });

    it("returns 403 when trial user already has 1 child (trial limit)", async () => {
      const user = await createUser(ds);
      await giveUserTrial(ds, user.id);

      // Create the first child (should succeed)
      await request(getApp().getHttpServer())
        .post("/children")
        .set("Authorization", authHeader(user.id))
        .send({ name: "Alice", age: 8, gender: "female" })
        .expect(201);

      // Second child should be rejected
      const res = await request(getApp().getHttpServer())
        .post("/children")
        .set("Authorization", authHeader(user.id))
        .send({ name: "Bob", age: 10, gender: "male" })
        .expect(403);

      expect(res.body.message).toBe("Your plan allows a maximum of 1 child");
    });

    it("returns 201 when user has paid FAMILY_PACK plan", async () => {
      const user = await createUser(ds);
      await giveUserPaidPlan(ds, user.id, PlanName.FAMILY_PACK);

      const res = await request(getApp().getHttpServer())
        .post("/children")
        .set("Authorization", authHeader(user.id))
        .send({ name: "Charlie", age: 6, gender: "male" })
        .expect(201);

      expect(res.body).toMatchObject({
        name: "Charlie",
        age: 6,
        gender: "male",
      });
    });
  });

  // ─── PATCH /children/:id ─────────────────────────────────────────────────────

  describe("PATCH /children/:id", () => {
    it("returns 401 without auth", async () => {
      await request(getApp().getHttpServer())
        .patch("/children/some-id")
        .send({ name: "Updated" })
        .expect(401);
    });

    it("returns 200 and updates child in DB", async () => {
      const user = await createUser(ds);
      await giveUserTrial(ds, user.id);

      const createRes = await request(getApp().getHttpServer())
        .post("/children")
        .set("Authorization", authHeader(user.id))
        .send({ name: "Alice", age: 8, gender: "female" })
        .expect(201);

      const childId = createRes.body.id;

      const updateRes = await request(getApp().getHttpServer())
        .patch(`/children/${childId}`)
        .set("Authorization", authHeader(user.id))
        .send({ name: "Alicia", age: 9 })
        .expect(200);

      expect(updateRes.body).toMatchObject({ name: "Alicia", age: 9 });

      const childInDb = await ds
        .getRepository(Child)
        .findOneBy({ id: childId });
      expect(childInDb.name).toBe("Alicia");
      expect(childInDb.age).toBe(9);
    });

    it("returns 404 when child does not belong to user", async () => {
      const user1 = await createUser(ds);
      const user2 = await createUser(ds);
      await giveUserTrial(ds, user1.id);

      const createRes = await request(getApp().getHttpServer())
        .post("/children")
        .set("Authorization", authHeader(user1.id))
        .send({ name: "Alice", age: 8, gender: "female" })
        .expect(201);

      const childId = createRes.body.id;

      await request(getApp().getHttpServer())
        .patch(`/children/${childId}`)
        .set("Authorization", authHeader(user2.id))
        .send({ name: "Hacked" })
        .expect(404);
    });
  });

  // ─── POST /children/:id/request-deletion ─────────────────────────────────────

  describe("POST /children/:id/request-deletion", () => {
    it("returns 401 without auth", async () => {
      await request(getApp().getHttpServer())
        .post("/children/some-id/request-deletion")
        .expect(401);
    });

    it("returns 404 when child is not found", async () => {
      const user = await createUser(ds);

      await request(getApp().getHttpServer())
        .post("/children/00000000-0000-0000-0000-000000000000/request-deletion")
        .set("Authorization", authHeader(user.id))
        .expect(404);
    });

    it("returns 200 with OTP message and creates VerificationToken in DB", async () => {
      const user = await createUser(ds);
      await giveUserTrial(ds, user.id);

      const createRes = await request(getApp().getHttpServer())
        .post("/children")
        .set("Authorization", authHeader(user.id))
        .send({ name: "Alice", age: 8, gender: "female" })
        .expect(201);

      const childId = createRes.body.id;

      const res = await request(getApp().getHttpServer())
        .post(`/children/${childId}/request-deletion`)
        .set("Authorization", authHeader(user.id))
        .expect(201);

      expect(res.body).toEqual({ message: "OTP sent to email" });

      const token = await ds.getRepository(VerificationToken).findOne({
        where: { userId: user.id, type: VerificationType.CHILD_DELETION },
      });
      expect(token).not.toBeNull();
      expect(token.isUsed).toBe(false);
    });
  });

  // ─── DELETE /children/:id ─────────────────────────────────────────────────────

  describe("DELETE /children/:id", () => {
    it("returns 401 without auth", async () => {
      await request(getApp().getHttpServer())
        .delete("/children/some-id")
        .send({ otp: "123456" })
        .expect(401);
    });

    it("returns 400 with wrong OTP", async () => {
      const user = await createUser(ds);
      await giveUserTrial(ds, user.id);

      const createRes = await request(getApp().getHttpServer())
        .post("/children")
        .set("Authorization", authHeader(user.id))
        .send({ name: "Alice", age: 8, gender: "female" })
        .expect(201);

      const childId = createRes.body.id;

      // Create a real OTP but send wrong one
      await createOtp(ds, user.id, VerificationType.CHILD_DELETION);

      await request(getApp().getHttpServer())
        .delete(`/children/${childId}`)
        .set("Authorization", authHeader(user.id))
        .send({ otp: "000000" })
        .expect(400);
    });

    it("returns 200 and deletes child from DB with correct OTP", async () => {
      const user = await createUser(ds);
      await giveUserTrial(ds, user.id);

      const createRes = await request(getApp().getHttpServer())
        .post("/children")
        .set("Authorization", authHeader(user.id))
        .send({ name: "Alice", age: 8, gender: "female" })
        .expect(201);

      const childId = createRes.body.id;

      const otp = await createOtp(ds, user.id, VerificationType.CHILD_DELETION);

      await request(getApp().getHttpServer())
        .delete(`/children/${childId}`)
        .set("Authorization", authHeader(user.id))
        .send({ otp })
        .expect(200);

      const childInDb = await ds
        .getRepository(Child)
        .findOneBy({ id: childId });
      expect(childInDb).toBeNull();
    });

    it("returns 400 when otp field is missing from body", async () => {
      const user = await createUser(ds);
      await giveUserTrial(ds, user.id);

      const createRes = await request(getApp().getHttpServer())
        .post("/children")
        .set("Authorization", authHeader(user.id))
        .send({ name: "Alice", age: 8, gender: "female" })
        .expect(201);

      const childId = createRes.body.id;

      await request(getApp().getHttpServer())
        .delete(`/children/${childId}`)
        .set("Authorization", authHeader(user.id))
        .send({})
        .expect(400);
    });
  });

  // ─── POST /children/:id/profile-image ────────────────────────────────────────

  describe("POST /children/:id/profile-image", () => {
    it("returns 401 without auth", async () => {
      await request(getApp().getHttpServer())
        .post("/children/some-id/profile-image")
        .attach("profileImage", Buffer.from("fake-image"), "test.jpg")
        .expect(401);
    });

    it("returns 404 when child is not found", async () => {
      const user = await createUser(ds);

      await request(getApp().getHttpServer())
        .post("/children/00000000-0000-0000-0000-000000000000/profile-image")
        .set("Authorization", authHeader(user.id))
        .attach("profileImage", Buffer.from("fake-image"), "test.jpg")
        .expect(404);
    });

    it("returns 200 and calls S3 upload for valid child", async () => {
      const user = await createUser(ds);
      await giveUserTrial(ds, user.id);

      const createRes = await request(getApp().getHttpServer())
        .post("/children")
        .set("Authorization", authHeader(user.id))
        .send({ name: "Alice", age: 8, gender: "female" })
        .expect(201);

      const childId = createRes.body.id;

      const res = await request(getApp().getHttpServer())
        .post(`/children/${childId}/profile-image`)
        .set("Authorization", authHeader(user.id))
        .attach("profileImage", Buffer.from("fake-image-data"), {
          filename: "test.jpg",
          contentType: "image/jpeg",
        })
        .expect(201);

      expect(mockS3.upload).toHaveBeenCalled();
      expect(res.body.profileImage).toBe("https://s3.test/mock-key.jpg");
    });
  });

  // ─── DELETE /children/:id/profile-image ──────────────────────────────────────

  describe("DELETE /children/:id/profile-image", () => {
    it("returns 401 without auth", async () => {
      await request(getApp().getHttpServer())
        .delete("/children/some-id/profile-image")
        .expect(401);
    });

    it("returns 404 when child is not found", async () => {
      const user = await createUser(ds);

      await request(getApp().getHttpServer())
        .delete("/children/00000000-0000-0000-0000-000000000000/profile-image")
        .set("Authorization", authHeader(user.id))
        .expect(404);
    });

    it("returns 200 and removes profile image from DB", async () => {
      const user = await createUser(ds);
      await giveUserTrial(ds, user.id);

      const createRes = await request(getApp().getHttpServer())
        .post("/children")
        .set("Authorization", authHeader(user.id))
        .send({ name: "Alice", age: 8, gender: "female" })
        .expect(201);

      const childId = createRes.body.id;

      // Upload an image first
      await request(getApp().getHttpServer())
        .post(`/children/${childId}/profile-image`)
        .set("Authorization", authHeader(user.id))
        .attach("profileImage", Buffer.from("fake-image-data"), {
          filename: "test.jpg",
          contentType: "image/jpeg",
        })
        .expect(201);

      jest.clearAllMocks();

      // Now remove it
      await request(getApp().getHttpServer())
        .delete(`/children/${childId}/profile-image`)
        .set("Authorization", authHeader(user.id))
        .expect(200);

      expect(mockS3.delete).toHaveBeenCalled();

      const childInDb = await ds
        .getRepository(Child)
        .findOneBy({ id: childId });
      expect(childInDb.profileImage).toBeNull();
    });
  });
});
