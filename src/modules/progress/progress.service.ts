import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { Child } from "../children/entities/child.entity";
import { ChildModule } from "../children/entities/child-module.entity";
import { ChildQuest } from "../children/entities/child-quest.entity";
import { ChildScreen } from "../children/entities/child-screen.entity";
import { moduleRegistry } from "../../constants/module-registry";
import { SaveScreenDto } from "./dto/save-screen.dto";

@Injectable()
export class ProgressService {
  constructor(
    @InjectRepository(Child)
    private readonly childRepository: Repository<Child>,
    private readonly dataSource: DataSource,
  ) {}

  async saveScreen(
    userId: string,
    childId: string,
    moduleNo: number,
    questNo: number,
    screenNo: number,
    dto: SaveScreenDto,
  ): Promise<ChildScreen> {
    const child = await this.childRepository.findOneBy({ id: childId, userId });
    if (!child) throw new ForbiddenException("Child not found");

    const moduleData = moduleRegistry.perModule[String(moduleNo)];
    if (!moduleData) throw new BadRequestException("Invalid module number");

    const questData = moduleData.quests[String(questNo)];
    if (!questData) throw new BadRequestException("Invalid quest number");

    if (screenNo < 1 || screenNo > questData.screens) {
      throw new BadRequestException("Invalid screen number");
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Validate previous module is completed
      if (moduleNo > 1) {
        const prevModule = await queryRunner.manager.findOne(ChildModule, {
          where: { childId, moduleNo: moduleNo - 1 },
        });
        if (!prevModule?.isCompleted) {
          throw new BadRequestException(
            `Module ${moduleNo - 1} must be completed first`,
          );
        }
      }

      // Find or create ChildModule
      let childModule = await queryRunner.manager.findOne(ChildModule, {
        where: { childId, moduleNo },
      });
      if (!childModule) {
        childModule = await queryRunner.manager.save(
          queryRunner.manager.create(ChildModule, { childId, moduleNo }),
        );
      }

      // Validate previous quest is completed
      if (questNo > 1) {
        const prevQuest = await queryRunner.manager.findOne(ChildQuest, {
          where: { moduleId: childModule.id, questNo: questNo - 1 },
        });
        if (!prevQuest?.isCompleted) {
          throw new BadRequestException(
            `Quest ${questNo - 1} must be completed first`,
          );
        }
      }

      // Find or create ChildQuest
      let childQuest = await queryRunner.manager.findOne(ChildQuest, {
        where: { moduleId: childModule.id, questNo },
      });
      if (!childQuest) {
        childQuest = await queryRunner.manager.save(
          queryRunner.manager.create(ChildQuest, {
            moduleId: childModule.id,
            questNo,
          }),
        );
      }

      // Validate previous screen is completed
      if (screenNo > 1) {
        const prevScreen = await queryRunner.manager.findOne(ChildScreen, {
          where: { questId: childQuest.id, screenNo: screenNo - 1 },
        });
        if (!prevScreen?.isCompleted) {
          throw new BadRequestException(
            `Screen ${screenNo - 1} must be completed first`,
          );
        }
      }

      // Find or create/update ChildScreen
      let screen = await queryRunner.manager.findOne(ChildScreen, {
        where: { questId: childQuest.id, screenNo },
      });

      if (!screen) {
        screen = queryRunner.manager.create(ChildScreen, {
          questId: childQuest.id,
          screenNo,
          data: dto.data ?? null,
          isCompleted: dto.isCompleted,
          completedAt: dto.isCompleted ? new Date() : null,
        });
      } else {
        const merged = { ...(screen.data ?? {}), ...(dto.data ?? {}) };
        screen.data = Object.fromEntries(
          Object.entries(merged).filter(([, v]) => v != null),
        );
        if (dto.isCompleted && !screen.isCompleted) {
          screen.completedAt = new Date();
        } else if (!dto.isCompleted) {
          screen.completedAt = null;
        }
        screen.isCompleted = dto.isCompleted;
      }
      screen = await queryRunner.manager.save(screen);

      // Cascade: check quest completion only when this screen is being completed
      if (dto.isCompleted && !childQuest.isCompleted) {
        const completedScreenCount = await queryRunner.manager.countBy(
          ChildScreen,
          { questId: childQuest.id, isCompleted: true },
        );

        if (completedScreenCount >= questData.screens) {
          childQuest.isCompleted = true;
          childQuest.completedAt = new Date();
          await queryRunner.manager.save(childQuest);

          // Cascade: check module completion
          if (!childModule.isCompleted) {
            const totalQuests = Object.keys(moduleData.quests).length;
            const completedQuestCount = await queryRunner.manager.countBy(
              ChildQuest,
              { moduleId: childModule.id, isCompleted: true },
            );

            if (completedQuestCount >= totalQuests) {
              childModule.isCompleted = true;
              childModule.completedAt = new Date();
              await queryRunner.manager.save(childModule);
            }
          }
        }
      }

      await queryRunner.commitTransaction();
      return screen;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getScreen(
    userId: string,
    childId: string,
    moduleNo: number,
    questNo: number,
    screenNo: number,
  ): Promise<ChildScreen> {
    const child = await this.childRepository.findOneBy({ id: childId, userId });
    if (!child) throw new ForbiddenException("Child not found");

    const childModule = await this.dataSource
      .getRepository(ChildModule)
      .findOneBy({ childId, moduleNo });
    if (!childModule) return {} as ChildScreen;

    const childQuest = await this.dataSource
      .getRepository(ChildQuest)
      .findOneBy({ moduleId: childModule.id, questNo });
    if (!childQuest) return {} as ChildScreen;

    const screen = await this.dataSource
      .getRepository(ChildScreen)
      .findOneBy({ questId: childQuest.id, screenNo });

    return screen ?? ({} as ChildScreen);
  }
}
