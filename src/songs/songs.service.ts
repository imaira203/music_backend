import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import YTMusic from 'ytmusic-api';
import { getHome } from '@hydralerne/youtube-api';

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

        let songs = await getHome({ isShorts: false, isYoutubeMusic: true });
        while (!songs.picks || !songs.albums) {
            songs = await getHome({ isShorts: false, isYoutubeMusic: true });
        }
        await this.cache.set(cacheKey, songs, 600); // cache 10 phút
        return songs;
    }
}
