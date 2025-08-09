import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { YoutubeService } from './youtube.service';
import { YoutubeController } from './youtube.controller';
import { UploadService } from '../utils/upload.service';

@Module({
  imports: [
    CacheModule.register({
      isGlobal: true,
    }),
  ],
  controllers: [YoutubeController],
  providers: [YoutubeService, UploadService],
})
export class YoutubeModule { }
