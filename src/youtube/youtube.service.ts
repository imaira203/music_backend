import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import YTMusic from 'ytmusic-api';
import { Response } from 'express';
import { VideoInfo, AudioStream, SearchResult, PlaylistInfo } from '../models/youtube.model';
import { UploadService } from '../utils/upload.service';
const ytdl = require("@distube/ytdl-core");
import * as fs from 'fs';

@Injectable()
export class YoutubeService {
    private ytmusic = new YTMusic();

    constructor(@Inject(CACHE_MANAGER) private cache: Cache, private uploadService: UploadService) {
        this.ytmusic.initialize();
    }

    /**
     * Lấy thông tin chi tiết của video từ video ID
     */
    async getVideoInfo(videoId: string): Promise<VideoInfo> {
        const cacheKey = `video-info-${videoId}`;
        const cached = await this.cache.get<VideoInfo>(cacheKey);
        if (cached) return cached;

        try {
            const songInfo = await this.ytmusic.getSong(videoId);

            const result: VideoInfo = {
                id: videoId,
                title: songInfo.name,
                artist: songInfo.artist?.name,
                duration: songInfo.duration?.toString(),
                thumbnailUrl: songInfo.thumbnails?.[0]?.url,
                videoId: videoId,
                formats: songInfo.formats || [],
                adaptiveFormats: songInfo.adaptiveFormats || []
            };

            // Cache trong 30 phút
            await this.cache.set(cacheKey, result, 1800);
            return result;
        } catch (error) {
            throw new Error(`Không thể lấy thông tin video: ${error.message}`);
        }
    }

    /**
     * Tạo audio stream URL cho video
     */
    async getAudioStreamUrl(videoId: string, quality: 'low' | 'medium' | 'high' = 'medium'): Promise<AudioStream> {
        const cacheKey = `audio-stream-${videoId}-${quality}`;
        const cached = await this.cache.get<AudioStream>(cacheKey);
        if (cached) return cached;

        try {

            const uploadResult = await this.uploadService.uploadFile(videoId);

            const result: AudioStream = {
                videoId,
                audioUrl: uploadResult.secure_url,
                mimeType: "audio/aac",
                expires: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString()
            }
            await this.cache.set(cacheKey, result, 300);

            return result;
        } catch (error) {
            throw new Error(`Không thể tạo audio stream URL: ${error.message}`);
        }
    }


    /**
     * Tạo audio stream trực tiếp
     */
    async createAudioStream(videoId: string, res: Response, quality: 'low' | 'medium' | 'high' = 'medium'): Promise<void> {
        try {
            let filter: any;

            switch (quality) {
                case 'low':
                    filter = (format) => format.audioBitrate && format.audioBitrate <= 64;
                    break;
                case 'high':
                    filter = (format) => format.audioBitrate && format.audioBitrate >= 128;
                    break;
                default:
                    filter = (format) => format.audioBitrate && format.audioBitrate >= 64 && format.audioBitrate < 128;
                    break;
            }

            res.setHeader('Content-Type', 'audio/mpeg');
            res.setHeader('Accept-Ranges', 'bytes');
            res.setHeader('Cache-Control', 'public, max-age=3600');

            ytdl(videoId, {
                filter: 'audioonly',
                quality: 'highestaudio'
            }).pipe(res);

        } catch (error) {
            res.status(500).json({ error: `Không thể tạo audio stream: ${error.message}` });
        }
    }


    /**
     * Lấy danh sách đề xuất dựa trên video ID
     */
    async getRelatedVideos(videoId: string, limit: number = 20): Promise<SearchResult[]> {
        const cacheKey = `related-videos-${videoId}-${limit}`;
        const cached = await this.cache.get<SearchResult[]>(cacheKey);
        if (cached) return cached;

        try {
            // Sử dụng search để lấy related videos
            const searchResults = await this.ytmusic.search(`${videoId} related`);

            const result: SearchResult[] = searchResults
                .filter(item => item.type === 'SONG' && 'videoId' in item && item.videoId !== videoId)
                .slice(0, limit)
                .map(item => {
                    if (item.type === 'SONG' && 'videoId' in item) {
                        return {
                            id: item.videoId,
                            title: item.name,
                            artist: item.artist?.name,
                            duration: item.duration?.toString(),
                            thumbnailUrl: item.thumbnails?.[0]?.url,
                            videoId: item.videoId,
                        };
                    }
                    return null;
                })
                .filter(Boolean) as SearchResult[];

            // Cache trong 15 phút
            await this.cache.set(cacheKey, result, 900);
            return result;
        } catch (error) {
            throw new Error(`Không thể lấy danh sách đề xuất: ${error.message}`);
        }
    }

    /**
     * Tìm kiếm video
     */
    async searchVideos(query: string, limit: number = 20): Promise<SearchResult[]> {
        const cacheKey = `search-${query}-${limit}`;
        const cached = await this.cache.get<SearchResult[]>(cacheKey);
        if (cached) return cached;

        try {
            const searchResults = await this.ytmusic.search(query);

            const result: SearchResult[] = searchResults
                .filter(item => item.type === 'SONG' && 'videoId' in item)
                .slice(0, limit)
                .map(item => {
                    if (item.type === 'SONG' && 'videoId' in item) {
                        return {
                            id: item.videoId,
                            title: item.name,
                            artist: item.artist?.name,
                            duration: item.duration?.toString(),
                            thumbnailUrl: item.thumbnails?.[0]?.url,
                            videoId: item.videoId,
                        };
                    }
                    return null;
                })
                .filter(Boolean) as SearchResult[];

            // Cache trong 10 phút
            await this.cache.set(cacheKey, result, 600);
            return result;
        } catch (error) {
            throw new Error(`Không thể tìm kiếm: ${error.message}`);
        }
    }

    /**
     * Lấy playlist từ playlist ID
     */
    async getPlaylist(playlistId: string): Promise<PlaylistInfo> {
        const cacheKey = `playlist-${playlistId}`;
        const cached = await this.cache.get<PlaylistInfo>(cacheKey);
        if (cached) return cached;

        try {
            const playlist = await this.ytmusic.getPlaylist(playlistId);

            const result: PlaylistInfo = {
                id: playlistId,
                title: playlist.name,
                thumbnailUrl: playlist.thumbnails?.[0]?.url,
                videoCount: playlist.videoCount,
                songs: [] // Initialize empty array since songs property might not exist
            };

            // Cache trong 30 phút
            await this.cache.set(cacheKey, result, 1800);
            return result;
        } catch (error) {
            throw new Error(`Không thể lấy playlist: ${error.message}`);
        }
    }
}
