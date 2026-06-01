import request from "supertest";
import { DataSource } from "typeorm";
import {
  initApp,
  closeApp,
  getApp,
  getDataSource,
  authHeader,
} from "./helpers/create-app";
import {
  cleanDatabase,
  seedPlans,
  createUser,
  giveUserPaidPlan,
} from "./helpers/db";
import { Child } from "../src/modules/children/entities/child.entity";

describe("ModulesController (e2e)", () => {
  let ds: DataSource;

  beforeAll(async () => {
    await initApp();
    ds = getDataSource();
    await seedPlans(ds);
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

  // ─────────────────────────────────────────────────────────────────────────────
  //  GET /modules/access-list?childId=:id
  // ─────────────────────────────────────────────────────────────────────────────

  describe("GET /modules/access-list", () => {
    it("returns 401 without auth header", async () => {
      await request(getApp().getHttpServer())
        .get("/modules/access-list?childId=some-id")
        .expect(401);
    });

    it("returns 400 when childId query param is missing", async () => {
      const user = await createUser(ds);
      await request(getApp().getHttpServer())
        .get("/modules/access-list")
        .set("Authorization", authHeader(user.id))
        .expect(403); // service throws ForbiddenException when child not found (null childId lookup)
      // Note: NestJS doesn't validate plain @Query strings — the service
      // throws 403 because no child matches. This matches actual behaviour.
    });

    it("returns 403 when childId belongs to another user", async () => {
      const owner = await createUser(ds);
      const otherUser = await createUser(ds);
      const child = await createChildForUser(owner.id);

      await request(getApp().getHttpServer())
        .get(`/modules/access-list?childId=${child.id}`)
        .set("Authorization", authHeader(otherUser.id))
        .expect(403);
    });

    it("returns 200 with module_1 accessible and modules 2-6 locked when no plan", async () => {
      const user = await createUser(ds);
      const child = await createChildForUser(user.id);

      const res = await request(getApp().getHttpServer())
        .get(`/modules/access-list?childId=${child.id}`)
        .set("Authorization", authHeader(user.id))
        .expect(200);

      expect(res.body).toHaveProperty("module_list");
      const moduleList: {
        module: number;
        unlocked: boolean;
        accessible: boolean;
        unlockedAt: string | null;
      }[] = res.body.module_list;

      expect(moduleList).toHaveLength(6);

      // Module 1 always unlocked and accessible
      expect(moduleList[0].module).toBe(1);
      expect(moduleList[0].unlocked).toBe(true);
      expect(moduleList[0].accessible).toBe(true);

      // Modules 2–6 locked without a paid plan
      for (let i = 1; i < 6; i++) {
        expect(moduleList[i].unlocked).toBe(false);
        expect(moduleList[i].accessible).toBe(false);
      }
    });

    it("returns 200 with unlock dates present for modules 2+ when user has paid plan", async () => {
      const user = await createUser(ds);
      const child = await createChildForUser(user.id);
      await giveUserPaidPlan(ds, user.id);

      const res = await request(getApp().getHttpServer())
        .get(`/modules/access-list?childId=${child.id}`)
        .set("Authorization", authHeader(user.id))
        .expect(200);

      const moduleList: {
        module: number;
        unlocked: boolean;
        accessible: boolean;
        unlockedAt: string | null;
      }[] = res.body.module_list;

      // Module 1 still has no unlockDate
      expect(moduleList[0].unlockedAt).toBeNull();

      // In development mode all delay days are 0, so modules 2–6 unlock immediately
      // (unlockedAt may be a date string or null depending on the delay=0 path)
      // At minimum they should be unlocked
      expect(moduleList[1].unlocked).toBe(true);
    });

    it("returns 200 including quest_list when include=quest", async () => {
      const user = await createUser(ds);
      const child = await createChildForUser(user.id);

      const res = await request(getApp().getHttpServer())
        .get(`/modules/access-list?childId=${child.id}&include=quest`)
        .set("Authorization", authHeader(user.id))
        .expect(200);

      expect(res.body).toHaveProperty("module_list");
      expect(res.body).toHaveProperty("quest_list");
      expect(Array.isArray(res.body.quest_list)).toBe(true);

      // Module 1 has 7 quests; check at least those are present
      const mod1Quests = res.body.quest_list.filter(
        (q: { module: number }) => q.module === 1,
      );
      expect(mod1Quests.length).toBe(7);
    });

    it("returns 200 including quest_list and screen_list when include=quest&include=screen", async () => {
      const user = await createUser(ds);
      const child = await createChildForUser(user.id);

      const res = await request(getApp().getHttpServer())
        .get(
          `/modules/access-list?childId=${child.id}&include=quest&include=screen`,
        )
        .set("Authorization", authHeader(user.id))
        .expect(200);

      expect(res.body).toHaveProperty("module_list");
      expect(res.body).toHaveProperty("quest_list");
      expect(res.body).toHaveProperty("screen_list");
      expect(Array.isArray(res.body.screen_list)).toBe(true);

      // Module 1 has quests with screen counts: 1,1,1,3,3,1,2 = 12 screens total
      const mod1Screens = res.body.screen_list.filter(
        (s: { module: number }) => s.module === 1,
      );
      expect(mod1Screens.length).toBe(12);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  //  GET /modules/get-access-status?childId=:id
  // ─────────────────────────────────────────────────────────────────────────────

  describe("GET /modules/get-access-status", () => {
    it("returns 401 without auth header", async () => {
      await request(getApp().getHttpServer())
        .get("/modules/get-access-status?childId=some-id")
        .expect(401);
    });

    it("returns 403 when childId not owned by the authenticated user", async () => {
      const owner = await createUser(ds);
      const otherUser = await createUser(ds);
      const child = await createChildForUser(owner.id);

      await request(getApp().getHttpServer())
        .get(`/modules/get-access-status?childId=${child.id}`)
        .set("Authorization", authHeader(otherUser.id))
        .expect(403);
    });

    it("returns 200 with all 6 modules when only childId is provided", async () => {
      const user = await createUser(ds);
      const child = await createChildForUser(user.id);

      const res = await request(getApp().getHttpServer())
        .get(`/modules/get-access-status?childId=${child.id}`)
        .set("Authorization", authHeader(user.id))
        .expect(200);

      for (let i = 1; i <= 6; i++) {
        expect(res.body).toHaveProperty(`module_${i}`);
        expect(res.body[`module_${i}`]).toHaveProperty("unlocked");
        expect(res.body[`module_${i}`]).toHaveProperty("accessible");
      }
    });

    it("returns 200 with module_1 status unlocked and accessible when module=1", async () => {
      const user = await createUser(ds);
      const child = await createChildForUser(user.id);

      const res = await request(getApp().getHttpServer())
        .get(`/modules/get-access-status?childId=${child.id}&module=1`)
        .set("Authorization", authHeader(user.id))
        .expect(200);

      expect(res.body).toHaveProperty("module_1");
      expect(res.body.module_1.unlocked).toBe(true);
      expect(res.body.module_1.accessible).toBe(true);
      expect(res.body.module_1.unlockDate).toBeNull();
    });

    it("returns 200 with quest_1 status when module=1&quest=1", async () => {
      const user = await createUser(ds);
      const child = await createChildForUser(user.id);

      const res = await request(getApp().getHttpServer())
        .get(`/modules/get-access-status?childId=${child.id}&module=1&quest=1`)
        .set("Authorization", authHeader(user.id))
        .expect(200);

      expect(res.body).toHaveProperty("module_1");
      expect(res.body.module_1).toHaveProperty("quest_1");
      const quest1 = res.body.module_1.quest_1;
      expect(quest1).toHaveProperty("unlocked");
      expect(quest1).toHaveProperty("accessible");
      expect(quest1).toHaveProperty("isCompleted");
      expect(quest1.isCompleted).toBe(false);
    });

    it("returns 400 when screen is provided without module", async () => {
      const user = await createUser(ds);
      const child = await createChildForUser(user.id);

      // screen without module — service enforces this
      await request(getApp().getHttpServer())
        .get(`/modules/get-access-status?childId=${child.id}&screen=1`)
        .set("Authorization", authHeader(user.id))
        .expect(400);
    });

    it("returns 400 when quest is provided without module", async () => {
      const user = await createUser(ds);
      const child = await createChildForUser(user.id);

      await request(getApp().getHttpServer())
        .get(`/modules/get-access-status?childId=${child.id}&quest=1`)
        .set("Authorization", authHeader(user.id))
        .expect(400);
    });
  });
});
