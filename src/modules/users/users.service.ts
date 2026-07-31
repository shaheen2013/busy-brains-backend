import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { createClerkClient } from "@clerk/backend";
import { User } from "./entities/user.entity";
import { UserPlan } from "../subscriptions/entities/user-plan.entity";
import { UpdateUserDto } from "./dtos/update-user.dto";
import { UpdatePasswordDto } from "./dtos/update-password.dto";
import { StorageService } from "../storage/storage.service";
import { AppConfig } from "../../config/app.config";
import { VerificationService } from "./verification.service";
import { VerificationType } from "./entities/verification-token.entity";
import { KitService } from "../kit/kit.service";
import { MODULE1_FREE_DAYS } from "../../constants/modules.constants";

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(UserPlan)
    private userPlanRepository: Repository<UserPlan>,
    private configService: ConfigService<AppConfig>,
    private storageService: StorageService,
    private verificationService: VerificationService,
    private kitService: KitService,
  ) {}

  findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id: id } });
  }

  async findOrCreateFromOAuth(params: {
    clerkId: string;
    email: string;
    name: string;
  }): Promise<{ user: User; isNew: boolean }> {
    const existing = await this.userRepository.findOne({
      where: { id: params.clerkId },
    });
    if (existing) return { user: existing, isNew: false };

    // A user may have previously registered via email/password with the same email
    const existingByEmail = await this.userRepository.findOne({
      where: { email: params.email },
    });
    if (existingByEmail) return { user: existingByEmail, isNew: false };

    const user = this.userRepository.create({
      id: params.clerkId,
      email: params.email,
      name: params.name,
      hasPassword: false,
    });
    const saved = await this.userRepository.save(user);
    return { user: saved, isNew: true };
  }

  async findWithActivePlan(id: string) {
    const user = await this.userRepository.findOne({ where: { id: id } });
    if (!user) return null;

    const userPlan = await this.userPlanRepository.findOne({
      where: { userId: id, isActive: true },
      relations: { plan: true },
    });

    const resource = await this.storageService.getResource("user", id);
    const profileImage =
      resource?.documents.find((d) => d.label === "profile")?.url ?? null;

    if (!userPlan) {
      const trialWindowEnd = new Date(user.createdAt);
      trialWindowEnd.setDate(trialWindowEnd.getDate() + MODULE1_FREE_DAYS);
      return {
        ...user,
        activePlan: {
          id: null,
          userId: null,
          planId: null,
          isTrial: false,
          trialStartedAt: null,
          trialEndsAt: null,
          isActive: false,
          purchasedAt: null,
          createdAt: null,
          plan: null,
          trialExpiredWithoutPurchase: new Date() >= trialWindowEnd,
        },
        profileImage,
      };
    }

    const plan = userPlan.isTrial
      ? { name: "TRIAL", trialEndsAt: userPlan.trialEndsAt }
      : userPlan.plan;

    const trialWindowEnd = new Date(userPlan.trialStartedAt ?? user.createdAt);
    trialWindowEnd.setDate(trialWindowEnd.getDate() + MODULE1_FREE_DAYS);
    const trialExpiredWithoutPurchase =
      !userPlan.purchasedAt && new Date() >= trialWindowEnd;

    return {
      ...user,
      activePlan: { ...userPlan, plan, trialExpiredWithoutPurchase },
      profileImage,
    };
  }

  async updateUser(
    userId: string,
    updateUserDto: UpdateUserDto,
    profileImage?: Express.Multer.File,
  ): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) return null;

    const secretKey = this.configService.get("clerk.secretKey", {
      infer: true,
    });
    if (secretKey) {
      const clerkClient = createClerkClient({ secretKey });
      try {
        await clerkClient.users.updateUser(userId, {
          firstName: updateUserDto.name ?? user.name,
          lastName: "",
          publicMetadata: {
            phoneNumber: updateUserDto.phoneNumber ?? user.phoneNumber,
            country: updateUserDto.country ?? user.country,
            state: updateUserDto.state ?? user.state,
            timezone: updateUserDto.timezone ?? user.timezone,
            age: updateUserDto.age ?? user.age,
            zipcode: updateUserDto.zipcode ?? user.zipcode,
          },
        });
      } catch (error) {
        console.error("Error updating Clerk user:", error);
        throw error;
      }
    }

    if (profileImage) {
      await this.storageService.upsertProfileImage(
        "user",
        userId,
        profileImage,
      );
    }

    const updatedUser = this.userRepository.merge(user, {
      name: updateUserDto.name ?? user.name,
      phoneNumber: updateUserDto.phoneNumber ?? user.phoneNumber,
      country: updateUserDto.country ?? user.country,
      state: updateUserDto.state ?? user.state,
      timezone: updateUserDto.timezone ?? user.timezone,
      age: updateUserDto.age ?? user.age,
      zipcode: updateUserDto.zipcode ?? user.zipcode,
    });

    return this.userRepository.save(updatedUser);
  }

  async updatePassword(
    userId: string,
    updatePasswordDto: UpdatePasswordDto,
  ): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException("User not found");
    }

    if (user.hasPassword && !updatePasswordDto.currentPassword) {
      throw new BadRequestException({
        message: "Current password is required to change your password",
        field: "currentPassword",
      });
    }

    const secretKey = this.configService.get("clerk.secretKey", {
      infer: true,
    });
    if (!secretKey) {
      throw new BadRequestException("Password update is not available");
    }

    const clerkClient = createClerkClient({ secretKey });

    if (user.hasPassword && updatePasswordDto.currentPassword) {
      try {
        const { verified } = await clerkClient.users.verifyPassword({
          userId,
          password: updatePasswordDto.currentPassword,
        });
        if (!verified) {
          throw new BadRequestException({
            message: "Current password is incorrect",
            field: "currentPassword",
          });
        }
      } catch (error: any) {
        if (error instanceof BadRequestException) throw error;
        throw new BadRequestException({
          message: "Current password is incorrect",
          field: "currentPassword",
        });
      }
    }

    try {
      await clerkClient.users.updateUser(userId, {
        password: updatePasswordDto.newPassword,
      });

      if (!user.hasPassword) {
        await this.userRepository.update(userId, { hasPassword: true });
      }
    } catch (error: any) {
      Logger.error(error);
      throw new BadRequestException({
        message: "Failed to update password. Please try again.",
        field: "newPassword",
      });
    }
  }

  async requestDeletion(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException("User not found");

    const otp = await this.verificationService.generateOtp(
      userId,
      VerificationType.ACCOUNT_DELETION,
    );

    await this.kitService.sendAccountDeletionOtp(userId, otp);

    return { message: "OTP sent to email" };
  }

  async deleteAccount(userId: string, otp: string) {
    await this.verificationService.verifyOtp(
      userId,
      VerificationType.ACCOUNT_DELETION,
      otp,
    );

    await this.userRepository.update(userId, { isDeleted: true });
    return { message: "Account deleted successfully" };
  }
}
