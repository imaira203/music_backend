import { Controller, Get, Post, Body, Patch, Param, Delete, Query, BadRequestException } from '@nestjs/common';
import { SearchService } from './search.service';
import { CreateSearchDto } from './dto/create-search.dto';
import { UpdateSearchDto } from './dto/update-search.dto';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) { }

  @Get('suggestions')
  async searchSuggestions(@Query('q') query: string) {
    if (!query) {
      return;
    }
    return this.searchService.searchSuggestions(query);
  }

  @Get()
  async search(@Query('q') query: string) {
    return this.searchService.search(query);
  }
}
