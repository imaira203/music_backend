import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import YTMusic from 'ytmusic-api'; // giả định bạn dùng ytmusic-api npm (hoặc thay thế)

@Injectable()
export class SongsService {
    private ytmusic = new YTMusic();

    constructor(@Inject(CACHE_MANAGER) private cache: Cache) {
        this.ytmusic.initialize();
    }

    async getSongs(): Promise<any[]> {
        const cacheKey = 'songs-list';
        const cached = await this.cache.get<any[]>(cacheKey);
        if (cached) return cached;

        // fetch từ ytmusic-api (giả lập)
        const songs = await this.ytmusic.getHomeSections(); // ví dụ thôi, tùy API thật bạn dùng
        await this.cache.set(cacheKey, songs, 600); // cache 10 phút
        return songs;
    }
}
