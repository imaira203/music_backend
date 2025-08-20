import { Injectable } from '@nestjs/common';
import { CreateSearchDto } from './dto/create-search.dto';
import { UpdateSearchDto } from './dto/update-search.dto';
import YTMusic from "ytmusic-api"

@Injectable()
export class SearchService {
  private ytmusic = new YTMusic();

  constructor() {
    this.ytmusic.initialize();
  }

  async searchSuggestions(query: string) {
    const results = await this.ytmusic.getSearchSuggestions(query);
    return results;
  }

  async search(query: string) {
    const results = await this.ytmusic.search(query);
    return results;
  }
}
