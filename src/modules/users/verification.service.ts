import { BadRequestException, Injectable } from "@nestjs/common";
import {
  VerificationToken,
  VerificationType,
} from "./entities/verification-token.entity";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import bcrypt from "bcrypt";

@Injectable()
export class VerificationService {
  constructor(
    @InjectRepository(VerificationToken)
    private repo: Repository<VerificationToken>,
  ) {}

  async generateOtp(userId: string, type: VerificationType) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const otpHash = await bcrypt.hash(otp, 10);

    const token = this.repo.create({
      userId,
      type,
      otpHash,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min
    });

    await this.repo.save(token);

    return otp; // send via email
  }

  async verifyOtp(userId: string, type: VerificationType, otp: string) {
    const token = await this.repo.findOne({
      where: {
        userId,
        type,
        isUsed: false,
      },
      order: { createdAt: "DESC" },
    });

    if (!token) throw new BadRequestException("No OTP found");

    if (token.expiresAt < new Date()) {
      throw new BadRequestException("OTP expired");
    }

    const isValid = await bcrypt.compare(otp, token.otpHash);
    if (!isValid) throw new BadRequestException("Invalid OTP");

    token.isUsed = true;
    await this.repo.save(token);

    return true;
  }
}
