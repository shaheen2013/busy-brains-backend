import request from "supertest";
import { DataSource } from "typeorm";
import {
  initApp,
  closeApp,
  getApp,
  getDataSource,
  authHeader,
} from "./helpers/create-app";
import { cleanDatabase, seedPlans, createUser } from "./helpers/db";
import { Child } from "../src/modules/children/entities/child.entity";
import { ChildModule } from "../src/modules/children/entities/child-module.entity";
import { ChildQuest } from "../src/modules/children/entities/child-quest.entity";
import { ChildScreen } from "../src/modules/children/entities/child-screen.entity";

// Module registry values used in tests:
//   Module 1, Quest 1 → screens: 1
//   Module 1, Quest 4 → screens: 3  (useful for multi-screen sequential tests)

describe("ProgressController (e2e)", () => {
  let ds: DataSource;

  beforeAll(async () => {
    await initApp();
    ds = getDataSource();
  });

  afterAll(async () => {
    await closeApp();
  });

  beforeEach(async () => {
    await cleanDatabase(ds);
    await seedPlans(ds);
  });

  // ─── helpers ────────────────────────────────────────────────────────────────

  async function createChildForUser(userId: string): Promise<Child> {
    const childRepo = ds.getRepository(Child);
    return childRepo.save(
      childRepo.create({ userId, name: "Test Child", age: 8, gender: "male" }),
    );
  }

  function progressUrl(
    childId: string,
    moduleNo: number,
    questNo: number,
    screenNo: number,
  ) {
    return `/children/${childId}/progress/${moduleNo}/${questNo}/${screenNo}`;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  //  POST /children/:childId/progress/:moduleNo/:questNo/:screenNo
  // ─────────────────────────────────────────────────────────────────────────────

  describe("POST /children/:childId/progress/:moduleNo/:questNo/:screenNo", () => {
    it("returns 401 without auth header", async () => {
      await request(getApp().getHttpServer())
        .post("/children/some-id/progress/1/1/1")
        .send({ isCompleted: false })
        .expect(401);
    });

    it("returns 403 when childId belongs to another user", async () => {
      const owner = await createUser(ds);
      const otherUser = await createUser(ds);
      const child = await createChildForUser(owner.id);

      await request(getApp().getHttpServer())
        .post(progressUrl(child.id, 1, 1, 1))
        .set("Authorization", authHeader(otherUser.id))
        .send({ isCompleted: false })
        .expect(403);
    });

    it("returns 400 for invalid moduleNo (99)", async () => {
      const user = await createUser(ds);
      const child = await createChildForUser(user.id);

      await request(getApp().getHttpServer())
        .post(progressUrl(child.id, 99, 1, 1))
        .set("Authorization", authHeader(user.id))
        .send({ isCompleted: false })
        .expect(400);
    });

    it("returns 400 for invalid questNo (99) within a valid module", async () => {
      const user = await createUser(ds);
      const child = await createChildForUser(user.id);

      await request(getApp().getHttpServer())
        .post(progressUrl(child.id, 1, 99, 1))
        .set("Authorization", authHeader(user.id))
        .send({ isCompleted: false })
        .expect(400);
    });

    it("returns 400 for invalid screenNo (99) within a valid module/quest", async () => {
      const user = await createUser(ds);
      const child = await createChildForUser(user.id);

      // Module 1, Quest 1 has only 1 screen — screenNo 99 is invalid
      await request(getApp().getHttpServer())
        .post(progressUrl(child.id, 1, 1, 99))
        .set("Authorization", authHeader(user.id))
        .send({ isCompleted: false })
        .expect(400);
    });

    it("returns 201 and creates a ChildScreen row in the DB for the first valid screen", async () => {
      const user = await createUser(ds);
      const child = await createChildForUser(user.id);

      const res = await request(getApp().getHttpServer())
        .post(progressUrl(child.id, 1, 1, 1))
        .set("Authorization", authHeader(user.id))
        .send({ isCompleted: false, data: { answer: "A" } })
        .expect(201);

      expect(res.body).toHaveProperty("id");
      expect(res.body.screenNo).toBe(1);
      expect(res.body.isCompleted).toBe(false);

      // Verify DB row exists
      const screenRepo = ds.getRepository(ChildScreen);
      const screenInDb = await screenRepo.findOneBy({ id: res.body.id });
      expect(screenInDb).not.toBeNull();
      expect(screenInDb.screenNo).toBe(1);
      expect(screenInDb.isCompleted).toBe(false);
    });

    it("returns 201 and sets isCompleted=true in DB when completing a screen", async () => {
      const user = await createUser(ds);
      const child = await createChildForUser(user.id);

      const res = await request(getApp().getHttpServer())
        .post(progressUrl(child.id, 1, 1, 1))
        .set("Authorization", authHeader(user.id))
        .send({ isCompleted: true })
        .expect(201);

      expect(res.body.isCompleted).toBe(true);

      // Verify DB
      const screenRepo = ds.getRepository(ChildScreen);
      const screenInDb = await screenRepo.findOneBy({ id: res.body.id });
      expect(screenInDb).not.toBeNull();
      expect(screenInDb.isCompleted).toBe(true);
      expect(screenInDb.completedAt).not.toBeNull();
    });

    it("returns 400 when trying to save screen 2 before screen 1 is completed (sequential enforcement)", async () => {
      const user = await createUser(ds);
      const child = await createChildForUser(user.id);

      // Complete quests 1-3 (each has 1 screen) so quest 4 becomes accessible
      for (const q of [1, 2, 3]) {
        await request(getApp().getHttpServer())
          .post(progressUrl(child.id, 1, q, 1))
          .set("Authorization", authHeader(user.id))
          .send({ isCompleted: true })
          .expect(201);
      }

      // Module 1, Quest 4 has 3 screens — save screen 1 without completing it
      await request(getApp().getHttpServer())
        .post(progressUrl(child.id, 1, 4, 1))
        .set("Authorization", authHeader(user.id))
        .send({ isCompleted: false })
        .expect(201);

      // Attempt to save screen 2 before screen 1 is complete → 400
      await request(getApp().getHttpServer())
        .post(progressUrl(child.id, 1, 4, 2))
        .set("Authorization", authHeader(user.id))
        .send({ isCompleted: false })
        .expect(400);
    });

    it("cascades quest completion when all screens in a single-screen quest are completed", async () => {
      const user = await createUser(ds);
      const child = await createChildForUser(user.id);

      // Module 1, Quest 1 has exactly 1 screen
      await request(getApp().getHttpServer())
        .post(progressUrl(child.id, 1, 1, 1))
        .set("Authorization", authHeader(user.id))
        .send({ isCompleted: true })
        .expect(201);

      // Verify the ChildQuest row is now completed
      const moduleRepo = ds.getRepository(ChildModule);
      const questRepo = ds.getRepository(ChildQuest);

      const childModule = await moduleRepo.findOneBy({
        childId: child.id,
        moduleNo: 1,
      });
      expect(childModule).not.toBeNull();

      const childQuest = await questRepo.findOneBy({
        moduleId: childModule.id,
        questNo: 1,
      });
      expect(childQuest).not.toBeNull();
      expect(childQuest.isCompleted).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  //  GET /children/:childId/progress/:moduleNo/:questNo/:screenNo
  // ─────────────────────────────────────────────────────────────────────────────

  describe("GET /children/:childId/progress/:moduleNo/:questNo/:screenNo", () => {
    it("returns 401 without auth header", async () => {
      await request(getApp().getHttpServer())
        .get("/children/some-id/progress/1/1/1")
        .expect(401);
    });

    it("returns 403 when childId belongs to another user", async () => {
      const owner = await createUser(ds);
      const otherUser = await createUser(ds);
      const child = await createChildForUser(owner.id);

      await request(getApp().getHttpServer())
        .get(progressUrl(child.id, 1, 1, 1))
        .set("Authorization", authHeader(otherUser.id))
        .expect(403);
    });

    it("returns 200 with empty object {} when screen has not been saved yet", async () => {
      const user = await createUser(ds);
      const child = await createChildForUser(user.id);

      const res = await request(getApp().getHttpServer())
        .get(progressUrl(child.id, 1, 1, 1))
        .set("Authorization", authHeader(user.id))
        .expect(200);

      expect(res.body).toEqual({});
    });

    it("returns 200 with screen data when screen was previously saved", async () => {
      const user = await createUser(ds);
      const child = await createChildForUser(user.id);

      // Save the screen first
      const postRes = await request(getApp().getHttpServer())
        .post(progressUrl(child.id, 1, 1, 1))
        .set("Authorization", authHeader(user.id))
        .send({ isCompleted: false, data: { score: 42 } })
        .expect(201);

      const savedId = postRes.body.id;

      // Now GET it back
      const getRes = await request(getApp().getHttpServer())
        .get(progressUrl(child.id, 1, 1, 1))
        .set("Authorization", authHeader(user.id))
        .expect(200);

      expect(getRes.body).toHaveProperty("id", savedId);
      expect(getRes.body.screenNo).toBe(1);
      expect(getRes.body.isCompleted).toBe(false);
      expect(getRes.body.data).toMatchObject({ score: 42 });
    });

    it("reflects isCompleted=true after the screen was completed via POST", async () => {
      const user = await createUser(ds);
      const child = await createChildForUser(user.id);

      await request(getApp().getHttpServer())
        .post(progressUrl(child.id, 1, 1, 1))
        .set("Authorization", authHeader(user.id))
        .send({ isCompleted: true })
        .expect(201);

      const res = await request(getApp().getHttpServer())
        .get(progressUrl(child.id, 1, 1, 1))
        .set("Authorization", authHeader(user.id))
        .expect(200);

      expect(res.body.isCompleted).toBe(true);
    });
  });
});
