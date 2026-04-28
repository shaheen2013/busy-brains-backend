import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { createClerkClient } from "@clerk/backend";
import { User } from "./entities/user.entity";
import { UserPlan } from "../subscriptions/entities/user-plan.entity";
import { UpdateUserDto } from "./dtos/update-user.dto";
import { AppConfig } from "../../config/app.config";

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(UserPlan)
    private userPlanRepository: Repository<UserPlan>,
    private configService: ConfigService<AppConfig>,
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

  async updateUser(userId: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) return null;

    // Update Clerk user metadata with firstName and lastName
    const secretKey = this.configService.get("clerk.secretKey", { infer: true });
    if (secretKey) {
      const clerkClient = createClerkClient({ secretKey });
      try {
        await clerkClient.users.updateUser(userId, {
          firstName: updateUserDto.firstName || user.firstName,
          lastName: updateUserDto.lastName || user.lastName,
          unsafeMetadata: {
            phoneNumber: updateUserDto.phoneNumber ?? user.phoneNumber,
            location: updateUserDto.location ?? user.location,
          },
        });
      } catch (error) {
        console.error("Error updating Clerk user:", error);
        throw error;
      }
    }

    // Update in our database
    const updatedUser = this.userRepository.merge(user, {
      firstName: updateUserDto.firstName ?? user.firstName,
      lastName: updateUserDto.lastName ?? user.lastName,
      phoneNumber: updateUserDto.phoneNumber ?? user.phoneNumber,
      location: updateUserDto.location ?? user.location,
    });

    return this.userRepository.save(updatedUser);
  }
}
