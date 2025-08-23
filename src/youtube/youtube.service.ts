import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { getData, filter, search, getRelatedAndLyrics, getPlaylist, getTrackData, getArtist } from '@hydralerne/youtube-api';
import { Response } from 'express';
import { AudioStream, SearchResult, PlaylistInfo } from '../models/youtube.model';
import { PrismaService } from '@/prisma/prisma.service';

import YTMusic from 'ytmusic-api';
import { EventEmitter } from 'events';
import { Innertube } from 'youtubei.js';

// Constants for optimization
const CONCURRENCY_LIMIT = 8;
const CACHE_TTL = {
    SONG_INFO: 1800,      // 30 minutes
    AUDIO_URL: 3600,      // 5 hours
    RELATED: 3600,         // 15 minutes
    SEARCH: 600,          // 10 minutes
    PLAYLIST: 3600,       // 30 minutes
    BATCH: 3600           // 30 minutes
};

// Worker pool for parallel processing
class WorkerPool {
    private workers: Array<Promise<any>> = [];
    private queue: Array<{ task: () => Promise<any>, resolve: (value: any) => void, reject: (error: any) => void }> = [];
    private activeWorkers = 0;

    constructor(private maxWorkers: number) { }

    async execute<T>(task: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            this.queue.push({ task, resolve, reject });
            this.processQueue();
        });
    }

    private async processQueue() {
        if (this.activeWorkers >= this.maxWorkers || this.queue.length === 0) {
            return;
        }

        this.activeWorkers++;
        const { task, resolve, reject } = this.queue.shift()!;

        try {
            const result = await task();
            resolve(result);
        } catch (error) {
            reject(error);
        } finally {
            this.activeWorkers--;
            this.processQueue();
        }
    }
}

@Injectable()
export class YoutubeService {
    // Optimized in-flight tracking with TTL
    private inflightInfo = new Map<string, { promise: Promise<any>, timestamp: number }>();
    private inflightAudio = new Map<string, { promise: Promise<{ audioUrl: string }>, timestamp: number }>();
    private inflightRelated = new Map<string, { promise: Promise<AudioStream[]>, timestamp: number }>();

    private ytmusic = new YTMusic();
    private workerPool: WorkerPool;
    private eventEmitter = new EventEmitter();

    // Cache for frequently accessed data
    private metadataCache = new Map<string, { data: any, timestamp: number, ttl: number }>();

    constructor(
        @Inject(CACHE_MANAGER) private cache: Cache,
        private prisma: PrismaService,
    ) {
        this.ytmusic.initialize();
        this.workerPool = new WorkerPool(CONCURRENCY_LIMIT);

        // Cleanup expired in-flight requests every 5 minutes
        setInterval(() => this.cleanupInflightRequests(), 5 * 60 * 1000);

        // Cleanup metadata cache every 10 minutes
        setInterval(() => this.cleanupMetadataCache(), 10 * 60 * 1000);
    }

    // ===== Cache Management ===================================================

    private async getCachedData<T>(key: string, ttl: number): Promise<T | null> {
        try {
            return await this.cache.get<T>(key);
        } catch (error) {
            console.warn(`Cache get error for key ${key}:`, error);
            return null;
        }
    }

    private async setCachedData<T>(key: string, data: T, ttl: number): Promise<void> {
        try {
            await this.cache.set(key, data, ttl);
        } catch (error) {
            console.warn(`Cache set error for key ${key}:`, error);
        }
    }

    private cleanupInflightRequests() {
        const now = Date.now();
        const ttl = 5 * 60 * 1000; // 5 minutes

        for (const [key, value] of this.inflightInfo.entries()) {
            if (now - value.timestamp > ttl) {
                this.inflightInfo.delete(key);
            }
        }

        for (const [key, value] of this.inflightAudio.entries()) {
            if (now - value.timestamp > ttl) {
                this.inflightAudio.delete(key);
            }
        }

        for (const [key, value] of this.inflightRelated.entries()) {
            if (now - value.timestamp > ttl) {
                this.inflightRelated.delete(key);
            }
        }
    }

    private cleanupMetadataCache() {
        const now = Date.now();
        for (const [key, value] of this.metadataCache.entries()) {
            if (now - value.timestamp > value.ttl * 1000) {
                this.metadataCache.delete(key);
            }
        }
    }

    // ===== Optimized Data Fetching ===========================================

    /** Lấy thông tin bài hát với caching thông minh và deduplication */
    private async getSongInfoCached(videoId: string): Promise<any> {
        const key = `song-info-${videoId}`;

        // Check in-memory cache first
        const memCached = this.metadataCache.get(key);
        if (memCached && Date.now() - memCached.timestamp < memCached.ttl * 1000) {
            return memCached.data;
        }

        // Check Redis cache
        const cached = await this.getCachedData<any>(key, CACHE_TTL.SONG_INFO);
        if (cached) {
            this.metadataCache.set(key, { data: cached, timestamp: Date.now(), ttl: CACHE_TTL.SONG_INFO });
            return cached;
        }

        // Check in-flight requests
        if (this.inflightInfo.has(videoId)) {
            return this.inflightInfo.get(videoId)!.promise;
        }

        const promise = this.workerPool.execute(async () => {
            try {
                // Parallel fetch from multiple sources
                const trackInfo = await getTrackData(videoId, { isYoutubeMusic: true });

                // Combine data with fallbacks
                const info = {
                    ...(trackInfo ? trackInfo : {}),
                    formats: trackInfo ? trackInfo.formats || trackInfo : {},
                    duration: trackInfo ? trackInfo.duration : null,
                    title: trackInfo ? trackInfo.title : null,
                    thumbnailUrl: trackInfo ? trackInfo.posterLarge : null,
                    artist: trackInfo ? trackInfo.artist : null
                };

                // Cache in both Redis and memory
                await this.setCachedData(key, info, CACHE_TTL.SONG_INFO);
                this.metadataCache.set(key, { data: info, timestamp: Date.now(), ttl: CACHE_TTL.SONG_INFO });

                return info;
            } finally {
                this.inflightInfo.delete(videoId);
            }
        });

        this.inflightInfo.set(videoId, { promise, timestamp: Date.now() });
        return promise;
    }

    /** Lazy loading audio URL - chỉ lấy khi cần thiết */
    private async getOrCreateSongAudio(videoId: string): Promise<{ audioUrl: string }> {
        const key = `audio-url-${videoId}`;

        // Check cache first
        const cached = await this.getCachedData<{ audioUrl: string }>(key, CACHE_TTL.AUDIO_URL);
        if (cached) return cached;

        // Check in-flight requests
        if (this.inflightAudio.has(videoId)) {
            return this.inflightAudio.get(videoId)!.promise;
        }

        const promise = this.workerPool.execute(async () => {
            try {
                const format = await getData(videoId);
                const bestAudio = filter(format.formats || format, 'bestaudio', {
                    minBitrate: 128000,
                    codec: 'mp4a'
                });

                if (!bestAudio || !bestAudio.url) {
                    throw new Error('Không thể lấy audio URL từ YouTube');
                }

                const result = { audioUrl: bestAudio.url };
                await this.setCachedData(key, result, CACHE_TTL.AUDIO_URL);
                return result;
            } finally {
                this.inflightAudio.delete(videoId);
            }
        });

        this.inflightAudio.set(videoId, { promise, timestamp: Date.now() });
        return promise;
    }

    // ===== Optimized Related Videos ==========================================

    /** Tối ưu hóa phần related videos với lazy loading và parallel processing */
    async getRelatedVideos(videoId: string): Promise<AudioStream[]> {
        const cacheKey = `related-videos-${videoId}`;

        // Check cache first
        const cached = await this.getCachedData<AudioStream[]>(cacheKey, CACHE_TTL.RELATED);
        if (cached) return cached;

        // Check in-flight requests
        if (this.inflightRelated.has(videoId)) {
            return this.inflightRelated.get(videoId)!.promise;
        }

        const promise = this.workerPool.execute(async () => {
            try {
                // Get related video IDs first (fast operation)
                const related = await this.ytmusic.getUpNexts(videoId);
                const randomVideos = related.slice(0, 8); // Increased from 5 to 8

                // Create lightweight results first (without audio URLs)
                const lightweightResults: AudioStream[] = await Promise.all(
                    randomVideos.map(async (video) => {
                        try {
                            const info = await this.getSongInfoCached(video.videoId);
                            return {
                                videoId: video.videoId,
                                title: info?.title || video.title || 'Unknown',
                                artist: info?.artist || 'Unknown',
                                audioUrl: '', // Will be filled later if needed
                                duration: info?.duration || null,
                                thumbnailUrl: info?.thumbnailUrl || `https://i.ytimg.com/vi/${video.videoId}/hq720.jpg`,
                                mimeType: 'audio/mp3',
                                expires: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
                            };
                        } catch (error) {
                            console.warn(`Failed to get info for related video ${video.videoId}:`, error);
                            return null;
                        }
                    })
                );

                // Filter out failed results
                const validResults = lightweightResults.filter(Boolean);

                // Cache lightweight results immediately for fast response
                await this.setCachedData(cacheKey, validResults, CACHE_TTL.RELATED);

                // Start background task to fetch audio URLs (non-blocking)
                this.fetchAudioUrlsInBackground(validResults, cacheKey);

                return validResults;
            } finally {
                this.inflightRelated.delete(videoId);
            }
        });

        this.inflightRelated.set(videoId, { promise, timestamp: Date.now() });
        return promise;
    }

    /** Background task để fetch audio URLs không blocking response */
    private async fetchAudioUrlsInBackground(results: AudioStream[], cacheKey: string): Promise<void> {
        // Don't await this - let it run in background
        setImmediate(async () => {
            try {
                const enhancedResults = await Promise.all(
                    results.map(async (result) => {
                        try {
                            const audio = await this.getOrCreateSongAudio(result.videoId);
                            return { ...result, audioUrl: audio.audioUrl };
                        } catch (error) {
                            console.warn(`Failed to get audio for ${result.videoId}:`, error);
                            return result; // Keep original without audio URL
                        }
                    })
                );

                // Update cache with enhanced results
                await this.setCachedData(cacheKey, enhancedResults, CACHE_TTL.RELATED);

                // Emit event for potential real-time updates
                this.eventEmitter.emit('relatedVideosEnhanced', { videoId: results[0]?.videoId, results: enhancedResults });
            } catch (error) {
                console.error('Background audio URL fetching failed:', error);
            }
        });
    }

    /** Get related videos with audio URLs (blocking version for when audio is needed) */
    async getRelatedVideosWithAudio(videoId: string): Promise<AudioStream[]> {
        const results = await this.getRelatedVideos(videoId);

        // If we already have audio URLs, return immediately
        if (results.every(r => r.audioUrl)) {
            return results;
        }

        // Otherwise, fetch audio URLs synchronously
        const enhancedResults = await Promise.all(
            results.map(async (result) => {
                if (result.audioUrl) return result;

                try {
                    const audio = await this.getOrCreateSongAudio(result.videoId);
                    return { ...result, audioUrl: audio.audioUrl };
                } catch (error) {
                    console.warn(`Failed to get audio for ${result.videoId}:`, error);
                    return result;
                }
            })
        );

        // Update cache
        const cacheKey = `related-videos-${videoId}`;
        await this.setCachedData(cacheKey, enhancedResults, CACHE_TTL.RELATED);

        return enhancedResults;
    }

    // ===== Optimized Batch Processing ========================================

    /** Tối ưu hóa batch processing với smart batching và parallel execution */
    async getBatchVideoInfo(videoIds: string[], res?: Response): Promise<AudioStream[]> {
        const ids = Array.from(new Set(videoIds.map(v => v.trim()).filter(Boolean)));
        const maxBatchSize = 15; // Increased from 10

        if (ids.length > maxBatchSize) {
            throw new Error(`Số lượng video không được vượt quá ${maxBatchSize}`);
        }

        // Check batch cache
        const cacheKey = `audio-stream-batch-${ids.sort().join(',')}`;
        const cached = await this.getCachedData<AudioStream[]>(cacheKey, CACHE_TTL.BATCH);
        if (cached) {
            if (res) res.status(200).json(cached);
            return cached;
        }

        // Process in parallel with worker pool
        const results = await Promise.all(
            ids.map(async (id) => {
                try {
                    const [info, audio] = await Promise.all([
                        this.getSongInfoCached(id),
                        this.getOrCreateSongAudio(id),
                    ]);

                    return this.buildAudioStream(id, info, audio.audioUrl);
                } catch (error) {
                    console.warn(`Failed to process video ${id}:`, error);
                    return null;
                }
            })
        );

        // Filter out failed results
        const validResults = results.filter(Boolean);

        // Cache results
        await this.setCachedData(cacheKey, validResults, CACHE_TTL.BATCH);

        if (res) res.status(200).json(validResults);
        return validResults;
    }

    // ===== Optimized Individual Methods ======================================

    /** Tối ưu hóa getVideoInfo với parallel processing */
    async getVideoInfo(videoId: string): Promise<AudioStream> {
        const cacheKey = `video-info-${videoId}`;
        const cached = await this.getCachedData<AudioStream>(cacheKey, CACHE_TTL.SONG_INFO);
        if (cached) return cached;

        try {
            const [info, audio] = await Promise.all([
                this.getSongInfoCached(videoId),
                this.getOrCreateSongAudio(videoId),
            ]);

            const result = this.buildAudioStream(videoId, info, audio.audioUrl);

            // Cache result
            await this.setCachedData(cacheKey, result, CACHE_TTL.SONG_INFO);
            return result;
        } catch (error) {
            console.error(`Failed to get video info for ${videoId}:`, error);
            throw new Error(`Không thể lấy thông tin video: ${error.message}`);
        }
    }

    // ===== Helper Methods ===================================================

    private buildAudioStream(videoId: string, info: any, audioUrl: string): AudioStream {
        return {
            videoId,
            title: info?.title || info?.name || 'Unknown',
            artist: info?.artist?.name || info?.author?.name || info?.artist || 'Unknown',
            audioUrl,
            duration: info?.duration || info?.lengthSeconds,
            thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hq720.jpg`,
            mimeType: 'audio/mp3',
            expires: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
        };
    }

    // ===== Public API Methods ===============================================

    async getAudioStreamUrl(videoId: string): Promise<AudioStream> {
        return this.getVideoInfo(videoId);
    }

    async searchVideos(query: string, limit = 20): Promise<SearchResult[]> {
        const cacheKey = `search-${query.toLowerCase().trim()}-${limit}`;
        const cached = await this.getCachedData<SearchResult[]>(cacheKey, CACHE_TTL.SEARCH);
        if (cached) return cached;

        try {
            const searchResults = await search(query);
            const result: SearchResult[] = searchResults
                .filter((i) => i.type === 'SONG' && 'videoId' in i)
                .slice(0, limit)
                .map((i: any) => ({
                    id: i.videoId,
                    title: i.name,
                    artist: typeof i.artists === 'string' ? i.artists : i.artists?.name,
                    duration: i.duration?.toString(),
                    thumbnailUrl: `https://i.ytimg.com/vi/${i.videoId}/hq720.jpg`,
                    videoId: i.videoId,
                }));

            await this.setCachedData(cacheKey, result, CACHE_TTL.SEARCH);
            return result;
        } catch (error) {
            console.error(`Search failed for query "${query}":`, error);
            throw new Error(`Không thể tìm kiếm: ${error.message}`);
        }
    }

    async getPlaylist(playlistId: string): Promise<PlaylistInfo> {
        const cacheKey = `playlist-${playlistId}`;
        const cached = await this.getCachedData<PlaylistInfo>(cacheKey, CACHE_TTL.PLAYLIST);
        if (cached) return cached;

        try {
            const playlistData = await getPlaylist(playlistId);
            const result: PlaylistInfo = {
                id: playlistId,
                title: playlistData?.title || playlistData?.name || 'Unknown Playlist',
                thumbnailUrl: `https://i.ytimg.com/vi/${playlistId}/hq720.jpg`,
                videoCount: playlistData?.videoCount || 0,
                songs: [],
            };

            await this.setCachedData(cacheKey, result, CACHE_TTL.PLAYLIST);
            return result;
        } catch (error) {
            console.error(`Failed to get playlist ${playlistId}:`, error);
            throw new Error(`Không thể lấy playlist: ${error.message}`);
        }
    }

    // ===== Event Listeners ==================================================

    onRelatedVideosEnhanced(callback: (data: { videoId: string, results: AudioStream[] }) => void) {
        this.eventEmitter.on('relatedVideosEnhanced', callback);
    }

    // ===== Health Check =====================================================

    async healthCheck(): Promise<{ status: string, cacheSize: number, inflightCount: number }> {
        return {
            status: 'healthy',
            cacheSize: this.metadataCache.size,
            inflightCount: this.inflightInfo.size + this.inflightAudio.size + this.inflightRelated.size
        };
    }
}
