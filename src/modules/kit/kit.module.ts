import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "../users/entities/user.entity";
import { KitService } from "./kit.service";

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [KitService],
  exports: [KitService],
})
export class KitModule {}
