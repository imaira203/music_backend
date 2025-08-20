import { Body, Controller, Post } from '@nestjs/common';
import { AccountsService } from './accounts.service';

@Controller('account')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) { }

  @Post('create')
  async createAccount(@Body() body: { username: string; password: string }) {
    return this.accountsService.createAccount(body.username, body.password);
  }

  @Post('login')
  async login(@Body() body: { username: string; password: string }) {
    return this.accountsService.login(body.username, body.password);
  }
}
