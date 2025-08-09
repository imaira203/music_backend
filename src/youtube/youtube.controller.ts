import { Controller, Get, Param, Query, Res, HttpException, HttpStatus, Post, Body } from '@nestjs/common';
import { YoutubeService } from './youtube.service';
import { VideoInfo, AudioStream, SearchResult, PlaylistInfo, VideoInfoWithAudio } from '../models/youtube.model';
import { Response } from 'express';

@Controller('youtube')
export class YoutubeController {
  constructor(private readonly youtubeService: YoutubeService) { }

  /**
   * Lấy thông tin chi tiết của video từ video ID
   * GET /youtube/video/:videoId
   */
  @Get('video/:videoId')
  async getVideoInfo(@Param('videoId') videoId: string): Promise<VideoInfo> {
    try {
      return await this.youtubeService.getVideoInfo(videoId);
    } catch (error) {
      throw new HttpException(
        `Không thể lấy thông tin video: ${error.message}`,
        HttpStatus.BAD_REQUEST
      );
    }
  }

  /**
   * Lấy thông tin video batch
   * POST /youtube/audio/batch
   * Body: { videoIds: string[] }
   */
  @Post('audio/batch')
  async getBatchAudio(@Body() body: { videoIds: string[] }, @Res() res: Response): Promise<AudioStream[]> {
    const videoIds = body.videoIds;
    try {
      return await this.youtubeService.getBatchVideoInfo(videoIds, res);
    } catch (error) {
      throw new HttpException(
        `Không thể lấy thông tin video: ${error.message}`,
        HttpStatus.BAD_REQUEST
      );
    }
  }

  /**
   * Lấy URL stream audio cho video
   * GET /youtube/audio/:videoId?quality=medium
   */
  @Get('audio/:videoId')
  async getAudioStreamUrl(
    @Param('videoId') videoId: string,
    @Query('quality') quality: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<AudioStream> {
    try {
      return await this.youtubeService.getAudioStreamUrl(videoId, quality);
    } catch (error) {
      throw new HttpException(
        `Không thể tạo audio stream URL: ${error.message}`,
        HttpStatus.BAD_REQUEST
      );
    }
  }

  /**
   * Lấy danh sách video đề xuất dựa trên video ID
   * GET /youtube/related/:videoId?limit=20
   */
  @Get('related/:videoId')
  async getRelatedVideos(
    @Param('videoId') videoId: string,
    @Query('limit') limit: string = '20'
  ): Promise<SearchResult[]> {
    try {
      const limitNum = parseInt(limit, 10);
      return await this.youtubeService.getRelatedVideos(videoId, limitNum);
    } catch (error) {
      throw new HttpException(
        `Không thể lấy danh sách đề xuất: ${error.message}`,
        HttpStatus.BAD_REQUEST
      );
    }
  }

  /**
   * Tìm kiếm video
   * GET /youtube/search?q=query&limit=20
   */
  @Get('search')
  async searchVideos(
    @Query('q') query: string,
    @Query('limit') limit: string = '20'
  ): Promise<SearchResult[]> {
    if (!query) {
      throw new HttpException(
        'Query parameter "q" is required',
        HttpStatus.BAD_REQUEST
      );
    }

    try {
      const limitNum = parseInt(limit, 10);
      return await this.youtubeService.searchVideos(query, limitNum);
    } catch (error) {
      throw new HttpException(
        `Không thể tìm kiếm: ${error.message}`,
        HttpStatus.BAD_REQUEST
      );
    }
  }

  /**
   * Lấy playlist từ playlist ID
   * GET /youtube/playlist/:playlistId
   */
  @Get('playlist/:playlistId')
  async getPlaylist(@Param('playlistId') playlistId: string): Promise<PlaylistInfo> {
    try {
      return await this.youtubeService.getPlaylist(playlistId);
    } catch (error) {
      throw new HttpException(
        `Không thể lấy playlist: ${error.message}`,
        HttpStatus.BAD_REQUEST
      );
    }
  }

  /**
   * Lấy thông tin video và URL stream audio cùng lúc
   * GET /youtube/info/:videoId?quality=medium
   */
  @Get('info/:videoId')
  async getVideoInfoWithAudio(
    @Param('videoId') videoId: string,
    @Query('quality') quality: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<VideoInfoWithAudio> {
    try {
      const [videoInfo, audioStream] = await Promise.all([
        this.youtubeService.getVideoInfo(videoId),
        this.youtubeService.getAudioStreamUrl(videoId, quality)
      ]);

      return {
        ...videoInfo,
        audioStream
      };
    } catch (error) {
      throw new HttpException(
        `Không thể lấy thông tin video: ${error.message}`,
        HttpStatus.BAD_REQUEST
      );
    }
  }
}
