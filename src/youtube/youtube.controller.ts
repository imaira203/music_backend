import { Controller, Get, Param, Query, Res, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { YoutubeService } from './youtube.service';
import { VideoInfo, AudioStream, SearchResult, PlaylistInfo, VideoInfoWithAudio } from '../models/youtube.model';

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
   * Tạo audio stream trực tiếp
   * GET /youtube/stream/:videoId?quality=medium
   */
  @Get('stream/:videoId')
  async createAudioStream(
    @Param('videoId') videoId: string,
    @Query('quality') quality: 'low' | 'medium' | 'high' = 'medium',
    @Res() res: Response
  ): Promise<void> {
    try {
      await this.youtubeService.createAudioStream(videoId, res, quality);
    } catch (error) {
      res.status(500).json({
        error: `Không thể tạo audio stream: ${error.message}`
      });
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
