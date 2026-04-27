import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "./entities/user.entity";
import { UserPlan } from "../subscriptions/entities/user-plan.entity";

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(UserPlan)
    private userPlanRepository: Repository<UserPlan>,
  ) {}

  findById(id: string): Promise<User | null> {
    return this.userRepository.findOneBy({ id });
  }

  async findWithActivePlan(id: string) {
    const user = await this.userRepository.findOneBy({ id });
    if (!user) return null;

    const userPlan = await this.userPlanRepository.findOne({
      where: { userId: id, isActive: true },
      relations: { plan: true },
    });

    if (!userPlan) return { ...user, activePlan: null };

    const plan = userPlan.isTrial
      ? { name: "TRIAL", trialEndsAt: userPlan.trialEndsAt }
      : userPlan.plan;

    return { ...user, activePlan: { ...userPlan, plan } };
  }
}
