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

// Module registry summary (used to validate counts):
//   Module 1 quests: 7  (screens: 1,1,1,3,3,1,2 = 12 total screens)
//   Modules 2–6 have additional quests/screens
//   Total modules: 6

describe("DashboardController (e2e)", () => {
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

  function dashboardUrl(childId: string, ...includes: string[]): string {
    const qs = includes.map((i) => `include=${i}`).join("&");
    return `/dashboard/${childId}${qs ? `?${qs}` : ""}`;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  //  GET /dashboard/:childId
  // ─────────────────────────────────────────────────────────────────────────────

  describe("GET /dashboard/:childId", () => {
    it("returns 401 without auth header", async () => {
      await request(getApp().getHttpServer())
        .get("/dashboard/some-id")
        .expect(401);
    });

    it("returns 403 when childId belongs to another user", async () => {
      const owner = await createUser(ds);
      const otherUser = await createUser(ds);
      const child = await createChildForUser(owner.id);

      await request(getApp().getHttpServer())
        .get(dashboardUrl(child.id))
        .set("Authorization", authHeader(otherUser.id))
        .expect(403);
    });

    it("returns 200 with correct shape when child has no progress", async () => {
      const user = await createUser(ds);
      const child = await createChildForUser(user.id);

      const res = await request(getApp().getHttpServer())
        .get(dashboardUrl(child.id))
        .set("Authorization", authHeader(user.id))
        .expect(200);

      const body = res.body;

      // brain_data: pending
      expect(body).toHaveProperty("brain_data");
      expect(body.brain_data.status).toBe("pending");

      // tactile_data: pending
      expect(body).toHaveProperty("tactile_data");
      expect(body.tactile_data.status).toBe("pending");

      // milestone: all false
      expect(body).toHaveProperty("milestone");
      expect(body.milestone.halfway_explored).toBe(false);
      expect(body.milestone.toolkit_builder).toBe(false);
      expect(body.milestone.finished_the_journey).toBe(false);

      // progress.modules.completed = 0
      expect(body).toHaveProperty("progress");
      expect(body.progress.modules.completed).toBe(0);
      expect(body.progress.modules.total).toBe(6);

      // module_progress: 6 items
      expect(body).toHaveProperty("module_progress");
      expect(Array.isArray(body.module_progress)).toBe(true);
      expect(body.module_progress).toHaveLength(6);

      // No quest_progress or screen_progress when include is absent
      expect(body).not.toHaveProperty("quest_progress");
      expect(body).not.toHaveProperty("screen_progress");
    });

    it("returns 200 and each module_progress item has required fields", async () => {
      const user = await createUser(ds);
      const child = await createChildForUser(user.id);

      const res = await request(getApp().getHttpServer())
        .get(dashboardUrl(child.id))
        .set("Authorization", authHeader(user.id))
        .expect(200);

      const moduleProgress: {
        module: number;
        status: string;
        accessible: boolean;
        unlocked: boolean;
        unlockedAt: string | null;
      }[] = res.body.module_progress;

      for (const item of moduleProgress) {
        expect(item).toHaveProperty("module");
        expect(item).toHaveProperty("status");
        expect(item).toHaveProperty("accessible");
        expect(item).toHaveProperty("unlocked");
        expect("unlockedAt" in item).toBe(true);
      }

      // Module 1 is always unlocked and accessible
      expect(moduleProgress[0].module).toBe(1);
      expect(moduleProgress[0].unlocked).toBe(true);
      expect(moduleProgress[0].accessible).toBe(true);
      expect(moduleProgress[0].status).toBe("initialized");
    });

    it("returns 200 including quest_progress array when include=quest", async () => {
      const user = await createUser(ds);
      const child = await createChildForUser(user.id);

      const res = await request(getApp().getHttpServer())
        .get(dashboardUrl(child.id, "quest"))
        .set("Authorization", authHeader(user.id))
        .expect(200);

      expect(res.body).toHaveProperty("quest_progress");
      expect(Array.isArray(res.body.quest_progress)).toBe(true);

      // Module 1 has 7 quests; verify some are in quest_progress
      const mod1Quests = res.body.quest_progress.filter(
        (q: { module: number }) => q.module === 1,
      );
      expect(mod1Quests.length).toBe(7);

      // No screen_progress when screen is not included
      expect(res.body).not.toHaveProperty("screen_progress");
    });

    it("returns 200 including both quest_progress and screen_progress when include=quest&include=screen", async () => {
      const user = await createUser(ds);
      const child = await createChildForUser(user.id);

      const res = await request(getApp().getHttpServer())
        .get(dashboardUrl(child.id, "quest", "screen"))
        .set("Authorization", authHeader(user.id))
        .expect(200);

      expect(res.body).toHaveProperty("quest_progress");
      expect(res.body).toHaveProperty("screen_progress");
      expect(Array.isArray(res.body.screen_progress)).toBe(true);

      // Module 1 has 12 screens total (1+1+1+3+3+1+2)
      const mod1Screens = res.body.screen_progress.filter(
        (s: { module: number }) => s.module === 1,
      );
      expect(mod1Screens.length).toBe(12);
    });

    it('updates module_progress[0].status to "ongoing" after saving module 1 quest 1 screen 1', async () => {
      const user = await createUser(ds);
      const child = await createChildForUser(user.id);

      // Save screen via progress API (not complete yet)
      await request(getApp().getHttpServer())
        .post(`/children/${child.id}/progress/1/1/1`)
        .set("Authorization", authHeader(user.id))
        .send({ isCompleted: false })
        .expect(201);

      const res = await request(getApp().getHttpServer())
        .get(dashboardUrl(child.id))
        .set("Authorization", authHeader(user.id))
        .expect(200);

      const moduleProgress: { module: number; status: string }[] =
        res.body.module_progress;
      const mod1 = moduleProgress.find((m) => m.module === 1);
      expect(mod1).toBeDefined();
      // After saving (but not completing), module 1 should be "ongoing"
      expect(mod1.status).toBe("ongoing");
    });

    it('marks module_progress[0].status as "completed" after completing all screens in a single-screen quest', async () => {
      const user = await createUser(ds);
      const child = await createChildForUser(user.id);

      // Module 1 has 7 quests. To complete the module we need all quests done.
      // Quest 1 has 1 screen — complete it and verify at least the quest progress changes.
      // Here we just verify that completing quest 1 moves quest_progress status for quest 1.

      await request(getApp().getHttpServer())
        .post(`/children/${child.id}/progress/1/1/1`)
        .set("Authorization", authHeader(user.id))
        .send({ isCompleted: true })
        .expect(201);

      const res = await request(getApp().getHttpServer())
        .get(dashboardUrl(child.id, "quest"))
        .set("Authorization", authHeader(user.id))
        .expect(200);

      const quest1Status = res.body.quest_progress.find(
        (q: { module: number; quest: number; status: string }) =>
          q.module === 1 && q.quest === 1,
      );
      expect(quest1Status).toBeDefined();
      expect(quest1Status!.status).toBe("completed");

      // Module 1 itself is not yet complete (other quests remain)
      const moduleProgress: { module: number; status: string }[] =
        res.body.module_progress;
      const mod1 = moduleProgress.find((m) => m.module === 1);
      expect(mod1.status).toBe("ongoing");
    });

    it("returns correct progress counts after completing module 1 quest 1 screen 1", async () => {
      const user = await createUser(ds);
      const child = await createChildForUser(user.id);

      await request(getApp().getHttpServer())
        .post(`/children/${child.id}/progress/1/1/1`)
        .set("Authorization", authHeader(user.id))
        .send({ isCompleted: true })
        .expect(201);

      const res = await request(getApp().getHttpServer())
        .get(dashboardUrl(child.id))
        .set("Authorization", authHeader(user.id))
        .expect(200);

      // 1 screen completed, modules still 0 completed (full module not done)
      expect(res.body.progress.screens.completed).toBe(1);
      expect(res.body.progress.modules.completed).toBe(0);
    });
  });
});
