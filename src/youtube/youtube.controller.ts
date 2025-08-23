import { Controller, Get, Param, Query, Res, HttpException, HttpStatus, Post, Body, Header } from '@nestjs/common';
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
  @Header('Cache-Control', 'public, max-age=3600')
  @Get('video/:videoId')
  async getVideoInfo(@Param('videoId') videoId: string): Promise<AudioStream> {
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
  @Header('Cache-Control', 'public, max-age=3600')
  @Post('audio/batch')
  async getBatchAudio(@Body() body: { videoIds: string[] }, @Res() res: Response): Promise<AudioStream[]> {
    const videoIds = body.videoIds;
    try {
      return await this.youtubeService.getBatchVideoInfo(videoIds, res);
    } catch (error) {
      console.log(error);
      throw new HttpException(
        `Không thể lấy thông tin video: ${error.message}`,
        HttpStatus.BAD_REQUEST
      );
    }
  }

  /**
   * Lấy danh sách video liên quan (fast response - không có audio URLs)
   * GET /youtube/related/:videoId
   */
  @Header('Cache-Control', 'public, max-age=3600')
  @Get('related/:videoId')
  async getRelatedVideos(@Param('videoId') videoId: string): Promise<AudioStream[]> {
    try {
      return await this.youtubeService.getRelatedVideos(videoId);
    } catch (error) {
      throw new HttpException(
        `Không thể lấy danh sách đề xuất: ${error.message}`,
        HttpStatus.BAD_REQUEST
      );
    }
  }

  /**
   * Lấy danh sách video liên quan với audio URLs (slower response)
   * GET /youtube/related/:videoId/audio
   */
  @Header('Cache-Control', 'public, max-age=3600')
  @Get('related/:videoId/audio')
  async getRelatedVideosWithAudio(@Param('videoId') videoId: string): Promise<AudioStream[]> {
    try {
      return await this.youtubeService.getRelatedVideosWithAudio(videoId);
    } catch (error) {
      throw new HttpException(
        `Không thể lấy danh sách đề xuất với audio: ${error.message}`,
        HttpStatus.BAD_REQUEST
      );
    }
  }

  /**
   * Lấy URL stream audio cho video
   * GET /youtube/audio/:videoId?quality=medium
   */
  @Header('Cache-Control', 'public, max-age=3600')
  @Get('audio/:videoId')
  async getAudioStreamUrl(
    @Param('videoId') videoId: string,
  ): Promise<AudioStream> {
    try {
      return await this.youtubeService.getAudioStreamUrl(videoId);
    } catch (error) {
      throw new HttpException(
        `Không thể tạo audio stream URL: ${error.message}`,
        HttpStatus.BAD_REQUEST
      );
    }
  }

  /**
   * Tìm kiếm video
   * GET /youtube/search?q=query&limit=20
   */
  @Header('Cache-Control', 'public, max-age=600')
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
  @Header('Cache-Control', 'public, max-age=3600')
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
   * Health check endpoint
   * GET /youtube/health
   */
  @Get('health')
  async healthCheck() {
    try {
      return await this.youtubeService.healthCheck();
    } catch (error) {
      throw new HttpException(
        `Service health check failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
