import { Controller, Get } from '@nestjs/common';
import { SongsService } from './songs.service';

@Controller('songs')
export class SongsController {
  constructor(private readonly songsService: SongsService) { }

  @Get()
  getAllSongs() {
    return this.songsService.getSongs();
  }
}
