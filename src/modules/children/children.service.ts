import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Child } from "./entities/child.entity";
import { UserPlan } from "../subscriptions/entities/user-plan.entity";
import { CreateChildDto } from "./dto/create-child.dto";
import { UpdateChildDto } from "./dto/update-child.dto";

const TRIAL_MAX_CHILDREN = 1;

@Injectable()
export class ChildrenService {
  constructor(
    @InjectRepository(Child)
    private readonly childRepository: Repository<Child>,
    @InjectRepository(UserPlan)
    private readonly userPlanRepository: Repository<UserPlan>,
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

  findAll(userId: string): Promise<Child[]> {
    return this.childRepository.findBy({ userId });
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
}
