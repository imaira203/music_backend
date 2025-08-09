// src/app.module.ts
import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { YoutubeModule } from './youtube/youtube.module';
import { SongsModule } from './songs/songs.module';
import { PrismaModule } from './prisma/prisma.module';
import * as redisStore from 'cache-manager-ioredis';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './prisma/prisma.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async () => ({
        store: redisStore,
        host: 'localhost',   // hoặc Redis URL nếu deploy
        port: 6379,
        ttl: 300, // mặc định: 5 phút
      }),
    }),
    YoutubeModule,
    SongsModule,
    PrismaModule,
  ],
  providers: [PrismaService],
})
export class AppModule { }
