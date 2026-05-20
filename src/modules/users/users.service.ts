import {
  Injectable,
  BadRequestException,
  NotFoundException,
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

    if (!userPlan) return { ...user, activePlan: null, profileImage };

    const plan = userPlan.isTrial
      ? { name: "TRIAL", trialEndsAt: userPlan.trialEndsAt }
      : userPlan.plan;

    return { ...user, activePlan: { ...userPlan, plan }, profileImage };
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
      throw new BadRequestException(
        "Current password is required to change your password",
      );
    }

    const secretKey = this.configService.get("clerk.secretKey", {
      infer: true,
    });
    if (!secretKey) {
      throw new BadRequestException("Password update is not available");
    }

    const clerkClient = createClerkClient({ secretKey });

    try {
      await clerkClient.users.updateUser(userId, {
        password: updatePasswordDto.newPassword,
      });

      if (!user.hasPassword) {
        await this.userRepository.update(userId, { hasPassword: true });
      }
    } catch (error: any) {
      if (error?.errors?.[0]?.message?.includes("password")) {
        throw new BadRequestException(
          "Failed to update password. Please try again.",
        );
      }
      throw error;
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
