import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { Child } from "./entities/child.entity";
import { ChildModule } from "./entities/child-module.entity";
import { ChildQuest } from "./entities/child-quest.entity";
import { ChildScreen } from "./entities/child-screen.entity";
import { UserPlan } from "../subscriptions/entities/user-plan.entity";
import { S3Service } from "../storage/s3.service";
import { CreateChildDto } from "./dto/create-child.dto";
import { UpdateChildDto } from "./dto/update-child.dto";
import { moduleRegistry } from "../../constants/module-registry";
import { Position } from "../../types/position";

const TRIAL_MAX_CHILDREN = 1;
const BUDDY_CUSTOMIZATION_KEY = "buddy_customization";

type AvatarData = {
  beard: string | null;
  glasses: string | null;
  hats: string | null;
  outfits: string | null;
} | null;

type nextContent = {
  moduleNo: number;
  questNo: number;
  screenNo: number;
} | null;

type EnrichedChild = Child & {
  avatar: AvatarData;
  nextContent: nextContent;
};

@Injectable()
export class ChildrenService {
  constructor(
    @InjectRepository(Child)
    private readonly childRepository: Repository<Child>,
    @InjectRepository(ChildModule)
    private readonly childModuleRepository: Repository<ChildModule>,
    @InjectRepository(ChildQuest)
    private readonly childQuestRepository: Repository<ChildQuest>,
    @InjectRepository(ChildScreen)
    private readonly childScreenRepository: Repository<ChildScreen>,
    @InjectRepository(UserPlan)
    private readonly userPlanRepository: Repository<UserPlan>,
    private readonly s3Service: S3Service,
  ) {}

  async create(userId: string, dto: CreateChildDto): Promise<Child> {
    const userPlan = await this.userPlanRepository.findOne({
      where: { userId, isActive: true },
      relations: { plan: true },
    });

    if (!userPlan) {
      throw new ForbiddenException("An active plan or trial is required");
    }

    const maxChildren = userPlan.isTrial
      ? TRIAL_MAX_CHILDREN
      : (userPlan.plan?.maxChildren ?? 0);

    const childCount = await this.childRepository.countBy({ userId });

    if (childCount >= maxChildren) {
      throw new ForbiddenException(
        `Your plan allows a maximum of ${maxChildren} child${maxChildren === 1 ? "" : "ren"}`,
      );
    }

    return this.childRepository.save(
      this.childRepository.create({ userId, ...dto }),
    );
  }

  async findAll(userId: string): Promise<EnrichedChild[]> {
    const children = await this.childRepository.findBy({ userId });
    if (children.length === 0) return [];

    const childIds = children.map((c) => c.id);

    // Batch-fetch all modules
    const allModules = await this.childModuleRepository.findBy({
      childId: In(childIds),
    });

    if (allModules.length === 0) {
      return children.map((c) => ({
        ...c,
        avatar: null,
        nextContent: null,
      }));
    }

    // Batch-fetch all quests
    const allModuleIds = allModules.map((m) => m.id);
    const allQuests = await this.childQuestRepository.findBy({
      moduleId: In(allModuleIds),
    });

    if (allQuests.length === 0) {
      return children.map((c) => ({
        ...c,
        avatar: null,
        nextContent: null,
      }));
    }

    // Batch-fetch all screens
    const allQuestIds = allQuests.map((q) => q.id);
    const allScreens = await this.childScreenRepository.findBy({
      questId: In(allQuestIds),
    });

    // Build lookup maps
    const modulesByChildId = new Map<string, ChildModule[]>();
    for (const m of allModules) {
      const arr = modulesByChildId.get(m.childId) ?? [];
      arr.push(m);
      modulesByChildId.set(m.childId, arr);
    }

    const questsByModuleId = new Map<string, ChildQuest[]>();
    for (const q of allQuests) {
      const arr = questsByModuleId.get(q.moduleId) ?? [];
      arr.push(q);
      questsByModuleId.set(q.moduleId, arr);
    }

    const screensByQuestId = new Map<string, ChildScreen[]>();
    for (const s of allScreens) {
      const arr = screensByQuestId.get(s.questId) ?? [];
      arr.push(s);
      screensByQuestId.set(s.questId, arr);
    }

    // Build per-child index of all screens with coordinates (for nextContent)
    type ScreenEntry = {
      screen: ChildScreen;
      moduleNo: number;
      questNo: number;
    };
    const screenEntriesByChildId = new Map<string, ScreenEntry[]>();
    for (const m of allModules) {
      for (const q of questsByModuleId.get(m.id) ?? []) {
        for (const s of screensByQuestId.get(q.id) ?? []) {
          const arr = screenEntriesByChildId.get(m.childId) ?? [];
          arr.push({ screen: s, moduleNo: m.moduleNo, questNo: q.questNo });
          screenEntriesByChildId.set(m.childId, arr);
        }
      }
    }

    return children.map((child) => {
      // Avatar: derive from m1/q6/s1 buddy_customization data
      const m1 = (modulesByChildId.get(child.id) ?? []).find(
        (m) => m.moduleNo === 1,
      );
      const q6 = m1
        ? (questsByModuleId.get(m1.id) ?? []).find((q) => q.questNo === 6)
        : undefined;
      const s1 = q6
        ? (screensByQuestId.get(q6.id) ?? []).find((s) => s.screenNo === 1)
        : undefined;

      let avatar: AvatarData = null;
      if (s1?.isCompleted && s1.data) {
        const bc = s1.data[BUDDY_CUSTOMIZATION_KEY] as Record<
          string,
          string | null
        > | null;
        if (bc) {
          avatar = {
            beard: bc.beard ?? null,
            glasses: bc.glasses ?? null,
            hats: bc.hats ?? null,
            outfits: bc.outfits ?? null,
          };
        }
      }

      // nextContent: most recently completed screen
      const entries = screenEntriesByChildId.get(child.id) ?? [];
      const completed = entries.filter(
        (e) => e.screen.isCompleted && e.screen.completedAt,
      );
      completed.sort(
        (a, b) =>
          new Date(b.screen.completedAt).getTime() -
          new Date(a.screen.completedAt).getTime(),
      );

      const last = completed[0];
      const nextContent: nextContent = last
        ? this.getNextContent({
            moduleNo: last.moduleNo,
            questNo: last.questNo,
            screenNo: last.screen.screenNo,
          })
        : null;

      return { ...child, avatar, nextContent };
    });
  }

  async update(
    userId: string,
    childId: string,
    dto: UpdateChildDto,
  ): Promise<Child> {
    const child = await this.childRepository.findOneBy({
      id: childId,
      userId,
    });

    if (!child) {
      throw new NotFoundException("Child not found");
    }

    Object.assign(child, dto);
    return this.childRepository.save(child);
  }

  async uploadProfileImage(
    userId: string,
    childId: string,
    file: Express.Multer.File,
  ): Promise<Child> {
    const child = await this.childRepository.findOneBy({ id: childId, userId });
    if (!child) throw new NotFoundException("Child not found");

    if (child.profileImage) {
      await this.s3Service.delete(this.extractS3Key(child.profileImage));
    }

    const { url } = await this.s3Service.upload(file, `children/${childId}`);
    child.profileImage = url;
    child.useAvatar = false;
    return this.childRepository.save(child);
  }

  async removeProfileImage(userId: string, childId: string): Promise<Child> {
    const child = await this.childRepository.findOneBy({ id: childId, userId });
    if (!child) throw new NotFoundException("Child not found");

    if (child.profileImage) {
      await this.s3Service.delete(this.extractS3Key(child.profileImage));
      child.profileImage = null;
      return this.childRepository.save(child);
    }

    return child;
  }

  async delete(userId: string, childId: string): Promise<void> {
    const child = await this.childRepository.findOneBy({
      id: childId,
      userId,
    });

    if (!child) {
      throw new NotFoundException("Child not found");
    }

    if (child.profileImage) {
      await this.s3Service
        .delete(this.extractS3Key(child.profileImage))
        .catch(() => {});
    }

    const modules = await this.childModuleRepository.findBy({ childId });
    if (modules.length > 0) {
      const moduleIds = modules.map((m) => m.id);
      const quests = await this.childQuestRepository.findBy({
        moduleId: In(moduleIds),
      });
      if (quests.length > 0) {
        await this.childScreenRepository.delete({
          questId: In(quests.map((q) => q.id)),
        });
        await this.childQuestRepository.delete({
          moduleId: In(moduleIds),
        });
      }
      await this.childModuleRepository.delete({ childId });
    }

    await this.childRepository.remove(child);
  }

  private extractS3Key(url: string): string {
    return new URL(url).pathname.slice(1);
  }

  private getNextContent(last: Position): Position {
    const modules = moduleRegistry.perModule;

    if (!last) {
      for (const m of Object.keys(modules).map(Number)) {
        for (const q of Object.keys(modules[m].quests).map(Number)) {
          const screens = modules[m].quests[q].screens;
          if (screens > 0) {
            return { moduleNo: m, questNo: q, screenNo: 1 };
          }
        }
      }

      return null;
    }

    let { moduleNo, questNo, screenNo } = last;

    while (true) {
      const module = modules[moduleNo];
      if (!module) return null;

      const quest = module.quests[questNo];

      if (quest && screenNo < quest.screens) {
        return {
          moduleNo,
          questNo,
          screenNo: screenNo + 1,
        };
      }

      questNo++;
      screenNo = 0;

      if (!module.quests[questNo]) {
        moduleNo++;
        questNo = 1;
      }
    }
  }
}
