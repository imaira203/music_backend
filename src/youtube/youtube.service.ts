import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import YTMusic from 'ytmusic-api';
import { Response } from 'express';
import { VideoInfo, AudioStream, SearchResult, PlaylistInfo } from '../models/youtube.model';
import { UploadService } from '../utils/upload.service';
const ytdl = require("@distube/ytdl-core");
import * as fs from 'fs';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class YoutubeService {
    private ytmusic = new YTMusic();

    constructor(
        @Inject(CACHE_MANAGER) private cache: Cache,
        private uploadService: UploadService,
        private prisma: PrismaService
    ) {
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
     * Lấy thông tin video batch
     * POST /youtube/audio/batch
     * Body: { videoIds: string[] }
     */
    async getBatchVideoInfo(videoIds: string[], res: Response): Promise<AudioStream[]> {
        // Giới hạn số lượng video được xử lý cùng lúc để tránh quá tải
        const maxBatchSize = 10;
        if (videoIds.length > maxBatchSize) {
            throw new Error(`Số lượng video không được vượt quá ${maxBatchSize}`);
        }
        const cacheKey = `audio-stream-${videoIds.join(',')}`;
        const cached = await this.cache.get<AudioStream[]>(cacheKey);
        if (cached) return cached;

        try {
            // Query tất cả songs từ database một lần thay vì loop
            const existingSongs = await this.prisma.song.findMany({
                where: {
                    id: {
                        in: videoIds
                    }
                }
            });

            // Tạo Map để lookup nhanh
            const songsMap = new Map(existingSongs.map(song => [song.id, song]));

            console.log(songsMap);

            // Kiểm tra cache cho từng song info trước khi gọi API
            const songInfos: any[] = [];
            const uncachedVideoIds: string[] = [];

            for (const videoId of videoIds) {
                const songCacheKey = `song-info-${videoId}`;
                const cachedSongInfo = await this.cache.get(songCacheKey);

                if (cachedSongInfo) {
                    songInfos.push(cachedSongInfo);
                } else {
                    songInfos.push(null); // placeholder
                    uncachedVideoIds.push(videoId);
                }
            }

            // Chỉ gọi API cho những songs chưa có trong cache
            if (uncachedVideoIds.length > 0) {
                const uncachedSongInfoPromises = uncachedVideoIds.map(videoId => this.ytmusic.getSong(videoId));
                const uncachedSongInfos = await Promise.all(uncachedSongInfoPromises);

                // Cache individual song info và fill vào array
                let uncachedIndex = 0;
                for (let i = 0; i < videoIds.length; i++) {
                    if (songInfos[i] === null) {
                        const songInfo = uncachedSongInfos[uncachedIndex];
                        songInfos[i] = songInfo;

                        // Cache individual song info trong 30 phút
                        const songCacheKey = `song-info-${videoIds[i]}`;
                        await this.cache.set(songCacheKey, songInfo, 1800);
                        uncachedIndex++;
                    }
                }
            }

            const result: AudioStream[] = [];

            // Xử lý các video đã có trong database
            for (let i = 0; i < videoIds.length; i++) {
                const videoId = videoIds[i];
                const songInfo = songInfos[i];
                const existingSong = songsMap.get(videoId);

                let audioUrl: string;

                if (existingSong) {
                    audioUrl = (existingSong as any).audioUrl;
                } else {
                    // Upload và tạo song mới
                    const uploadResult = await this.uploadService.uploadFile(videoId);
                    const song = await this.prisma.song.create({
                        data: {
                            id: videoId,
                            title: songInfo.name,
                            audioUrl: uploadResult.secure_url,
                            thumbnailUrl: songInfo.thumbnails?.[songInfo.thumbnails.length - 1]?.url,
                            duration: songInfo.duration,
                            artist: songInfo.artist?.name,
                        }
                    });
                    audioUrl = song.audioUrl;

                    // Cache song sau khi tạo
                    const songCacheKey = `song-${videoId}`;
                    await this.cache.set(songCacheKey, song, 3600); // Cache 1 giờ
                }

                result.push({
                    videoId: videoId,
                    audioUrl: audioUrl,
                    artist: songInfo.artist?.name,
                    title: songInfo.name,
                    thumbnailUrl: songInfo.thumbnails?.[songInfo.thumbnails.length - 1]?.url,
                    mimeType: "audio/aac",
                    expires: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString()
                });
            }

            await this.cache.set(cacheKey, result, 1800);
            res.status(200).json(result);
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
            // Kiểm tra cache cho song info trước
            const songInfoCacheKey = `song-info-${videoId}`;
            let detailSong = await this.cache.get(songInfoCacheKey) as any;

            if (!detailSong) {
                detailSong = await this.ytmusic.getSong(videoId);
                // Cache song info trong 30 phút
                await this.cache.set(songInfoCacheKey, detailSong, 1800);
            }

            // Kiểm tra cache cho database song trước
            const songCacheKey = `song-${videoId}`;
            let songExist = await this.cache.get(songCacheKey) as any;

            if (!songExist) {
                songExist = await this.prisma.song.findUnique({
                    where: {
                        id: videoId
                    }
                });

                if (songExist) {
                    // Cache song trong 1 giờ
                    await this.cache.set(songCacheKey, songExist, 3600);
                }
            }

            let audioUrl: string;

            if (!songExist) {
                const uploadResult = await this.uploadService.uploadFile(videoId);
                const song = await this.prisma.song.create({
                    data: {
                        id: videoId,
                        title: detailSong.name,
                        audioUrl: uploadResult.secure_url,
                        thumbnailUrl: detailSong.thumbnails?.[detailSong.thumbnails.length - 1]?.url,
                        duration: detailSong.duration,
                        artist: detailSong.artist?.name,
                    }
                });
                audioUrl = song.audioUrl;

                // Cache newly created song
                await this.cache.set(songCacheKey, song, 3600);
            } else {
                audioUrl = (songExist as any).audioUrl;
            }

            const result: AudioStream = {
                videoId,
                audioUrl: audioUrl,
                artist: detailSong.artist?.name,
                title: detailSong.name,
                thumbnailUrl: detailSong.thumbnails?.[detailSong.thumbnails.length - 1]?.url,
                mimeType: "audio/aac",
                expires: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString()
            }

            // Cache kết quả cuối cùng với thời gian ngắn hơn vì có expires
            await this.cache.set(cacheKey, result, 300);

            return result;
        } catch (error) {
            throw new Error(`Không thể tạo audio stream URL: ${error.message}`);
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
