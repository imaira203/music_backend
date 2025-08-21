import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { getData, filter, search, getRelatedAndLyrics, getPlaylist, getTrackData, getArtist } from '@hydralerne/youtube-api';
import { Response } from 'express';
import { AudioStream, SearchResult, PlaylistInfo } from '../models/youtube.model';
import { PrismaService } from '@/prisma/prisma.service';
import YTMusic from 'ytmusic-api';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function getAudioUrlYTDLP(videoId) {
    try {
        // Gọi yt-dlp để lấy direct URL stream
        const { stdout } = await execAsync(
            `yt-dlp -f bestaudio --extract-audio --audio-format mp3 -g https://www.youtube.com/watch?v=${videoId}`
        );
        const url = stdout.trim();

        return {
            url,
            itag: 140,
            mimeType: 'audio/mp4; codecs="mp4a.40.2"',
        };
    } catch (err) {
        console.error('yt-dlp error:', err);
        throw new Error('Không lấy được audio stream URL');
    }
}

// Concurrency helpers
const CONCURRENCY = 3;

@Injectable()
export class YoutubeService {
    // Dedupe in-flight theo videoId để tránh upload/lookup trùng lúc cao điểm
    private inflightInfo = new Map<string, Promise<any>>();
    private inflightSong = new Map<string, Promise<{ audioUrl: string }>>();
    private ytmusic = new YTMusic();

    constructor(
        @Inject(CACHE_MANAGER) private cache: Cache,
        private prisma: PrismaService,
    ) {
        this.ytmusic.initialize();
    }

    // ===== Helpers ============================================================

    /** Lấy thông tin bài hát & cache 30 phút (dedupe in-flight) */
    private async getSongInfoCached(videoId: string): Promise<any> {
        const key = `song-info-${videoId}`;
        const cached = await this.cache.get<any>(key);
        if (cached) return cached;

        if (this.inflightInfo.has(videoId)) return this.inflightInfo.get(videoId)!;

        const p = (async () => {
            // Lấy metadata từ getData (có formats) và track info từ getTrackData
            const [videoData, trackInfo] = await Promise.all([
                getData(videoId),
                getTrackData(videoId, { isYoutubeMusic: true })
            ]);

            const artist = await this.ytmusic.getVideo(videoId);

            // Kết hợp thông tin từ cả hai API
            const info = {
                ...trackInfo,
                formats: videoData.formats || videoData,
                duration: trackInfo.duration || videoData.duration,
                title: trackInfo.title || videoData.title,
                artist: artist.artist || videoData.artist?.name
            };

            await this.cache.set(key, info, 1800);
            this.inflightInfo.delete(videoId);
            return info;
        })().catch((e) => {
            this.inflightInfo.delete(videoId);
            throw e;
        });

        this.inflightInfo.set(videoId, p);
        return p;
    }

    /** Đảm bảo đã có audioUrl từ @hydralerne/youtube-api cho videoId: lấy DB, nếu thiếu thì lấy từ API (dedupe in-flight) */
    private async getOrCreateSongAudio(videoId: string): Promise<{ audioUrl: string }> {
        const p = (async () => {
            // const format = await getData(videoId);

            // const bestAudio = filter(format.formats || format, 'bestaudio', { minBitrate: 128000, codec: 'mp4a' });

            const bestAudio = await getAudioUrlYTDLP(videoId);

            if (!bestAudio || !bestAudio.url) {
                throw new Error('Không thể lấy audio URL từ YouTube');
            }

            const audioUrl = bestAudio.url;

            this.inflightSong.delete(videoId);
            return { audioUrl };
        })().catch((e) => {
            this.inflightSong.delete(videoId);
            throw e;
        });

        this.inflightSong.set(videoId, p);
        return p;
    }

    /** Gộp thành AudioStream trả về client (mime chuẩn & thumb nhanh từ i.ytimg) */
    private buildAudioStream(videoId: string, info: any, audioUrl: string): AudioStream {
        return {
            videoId,
            title: info?.title || info?.name,
            artist: info?.artist?.name || info?.author?.name,
            audioUrl,
            duration: info?.duration || info?.lengthSeconds,
            thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hq720.jpg`,
            mimeType: 'audio/mp3', // MP3
            expires: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(), // 6h
        };
    }

    // Map with limited concurrency
    private async mapWithConcurrency<I, O>(
        items: I[],
        limit: number,
        fn: (item: I, index: number) => Promise<O>,
    ): Promise<O[]> {
        const ret: O[] = [];
        let i = 0;

        const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
            while (i < items.length) {
                const idx = i++;
                ret[idx] = await fn(items[idx], idx);
            }
        });

        await Promise.all(workers);
        return ret;
    }

    // ===== APIs ==============================================================



    /** Batch: chạy song song có giới hạn, dedupe, và tránh upload thừa */
    async getBatchVideoInfo(videoIds: string[], res?: Response): Promise<AudioStream[]> {
        // Chuẩn hóa input: trim, dedupe, giới hạn số lượng
        const ids = Array.from(new Set(videoIds.map(v => v.trim()).filter(Boolean)));
        const maxBatchSize = 10;
        if (ids.length > maxBatchSize) {
            throw new Error(`Số lượng video không được vượt quá ${maxBatchSize}`);
        }

        // Cache chung cho batch (tùy chọn)
        const cacheKey = `audio-stream-${ids.join(',')}`;
        const cached = await this.cache.get<AudioStream[]>(cacheKey);
        if (cached) {
            if (res) res.status(200).json(cached);
            return cached;
        }

        // Chạy song song có giới hạn
        const results = await this.mapWithConcurrency(ids, 3, async (id) => {
            const [info, audio] = await Promise.all([
                this.getSongInfoCached(id),
                this.getOrCreateSongAudio(id),
            ]);

            return this.buildAudioStream(id, info, audio.audioUrl);
        });

        await this.cache.set(cacheKey, results, 1800);
        if (res) res.status(200).json(results);
        return results;
    }

    /** Tạo audio stream URL (giữ lại API cũ, dùng core mới) */
    async getAudioStreamUrl(videoId: string): Promise<AudioStream> {
        return this.getVideoInfo(videoId);
    }

    /** Lấy thông tin video từ @hydralerne/youtube-api */
    async getVideoInfo(videoId: string): Promise<AudioStream> {
        const cacheKey = `video-info-${videoId}`;
        const cached = await this.cache.get<AudioStream>(cacheKey);
        if (cached) return cached;

        try {
            const [info, audio] = await Promise.all([
                this.getSongInfoCached(videoId),
                this.getOrCreateSongAudio(videoId),
            ]);

            console.log(audio)

            const result = this.buildAudioStream(videoId, info, audio.audioUrl);
            console.log(result);

            // Cache trong 30 phút
            await this.cache.set(cacheKey, result, 1800);
            return result;
        } catch (error) {
            console.log(error);
            throw new Error(`Không thể lấy thông tin video: ${error.message}`);
        }
    }

    async getRelatedVideos(videoId: string): Promise<AudioStream[]> {
        const cacheKey = `related-videos-${videoId}`;
        const cached = await this.cache.get<AudioStream[]>(cacheKey);
        if (cached) return cached;

        const related = await this.ytmusic.getUpNexts(videoId);
        // lấy ngẫu nhiên 5 video trong danh sách related
        const randomVideos = related.slice(0, 5);
        const results = await Promise.all(randomVideos.map(async (video) => {
            const [info, audio] = await Promise.all([
                this.getSongInfoCached(video.videoId),
                this.getOrCreateSongAudio(video.videoId),
            ]);
            return this.buildAudioStream(video.videoId, info, audio.audioUrl);
        }));
        await this.cache.set(cacheKey, results, 900);
        return results;
    }

    async searchVideos(query: string, limit = 20): Promise<SearchResult[]> {
        const cacheKey = `search-${query}-${limit}`;
        const cached = await this.cache.get<SearchResult[]>(cacheKey);
        if (cached) return cached;

        const searchResults = await search(query);
        const result: SearchResult[] = searchResults
            .filter((i) => i.type === 'SONG' && 'videoId' in i)
            .slice(0, limit)
            .map((i: any) => ({
                id: i.videoId,
                title: i.name,
                artist: i.artist?.name,
                duration: i.duration?.toString(),
                thumbnailUrl: `https://i.ytimg.com/vi/${i.videoId}/hq720.jpg`,
                videoId: i.videoId,
            }));

        await this.cache.set(cacheKey, result, 600);
        return result;
    }

    async getPlaylist(playlistId: string): Promise<PlaylistInfo> {
        const cacheKey = `playlist-${playlistId}`;
        const cached = await this.cache.get<PlaylistInfo>(cacheKey);
        if (cached) return cached;

        // @hydralerne/youtube-api không có getPlaylist, sử dụng getData thay thế
        const playlistData = await getPlaylist(playlistId);
        const result: PlaylistInfo = {
            id: playlistId,
            title: playlistData?.title || playlistData?.name || 'Unknown Playlist',
            thumbnailUrl: `https://i.ytimg.com/vi/${playlistId}/hq720.jpg`,
            videoCount: playlistData?.videoCount || 0,
            songs: [],
        };
        await this.cache.set(cacheKey, result, 1800);
        return result;
    }
}
