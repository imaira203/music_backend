import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { YoutubeService } from './youtube.service';
import { YoutubeController } from './youtube.controller';
import { PrismaService } from '@/prisma/prisma.service';

@Module({
  imports: [
    CacheModule.register({
      isGlobal: true,
    }),
  ],
  controllers: [YoutubeController],
  providers: [YoutubeService, PrismaService],
})
export class YoutubeModule { }
