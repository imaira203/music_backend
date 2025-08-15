import { Controller, Get, Header } from '@nestjs/common';
import { SongsService } from './songs.service';

@Controller('songs')
export class SongsController {
  constructor(private readonly songsService: SongsService) { }

  @Get()
  @Header('Cache-Control', 'public, max-age=600')
  getAllSongs() {
    // set cache to header
    // INSERT_YOUR_CODE
    // Set Cache-Control header to cache for 1 hour
    // Note: In NestJS, you can use the @Header() decorator or set headers via the response object.
    // Since we don't have access to the response object here, you can use the @Header decorator:
    // @Header('Cache-Control', 'public, max-age=3600')
    // However, since decorators must be placed above the method, you may need to refactor.
    // Alternatively, if you want to set it here, you need to inject the response object.
    // Example (if you want to use the response object):
    // import { Res } from '@nestjs/common';
    // getAllSongs(@Res() res) {
    //   res.set('Cache-Control', 'public, max-age=3600');
    //   return res.send(this.songsService.getSongs());
    // }
    // For now, here's a comment indicating the cache header should be set.
    return this.songsService.getSongs();
  }
}
