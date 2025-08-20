import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) { }

  async login(username: string, password: string) {
    const account = await this.prisma.accounts.findUnique({
      where: { username },
    });

    if (!account) {
      throw new BadRequestException('Account not found');
    }

    const isPasswordValid = await bcrypt.compare(password, account.password);

    if (!isPasswordValid) {
      throw new BadRequestException('Invalid password');
    }

    return {
      message: 'Login successful',
      data: {
        id: Number(account.id),
        username: account.username,
      }
    };
  }

  async createAccount(username: string, password: string) {
    const existingAccount = await this.prisma.accounts.findUnique({
      where: { username },
    });

    if (existingAccount) {
      throw new BadRequestException('Account already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const account = await this.prisma.accounts.create({
      data: { username, password: hashedPassword },
    });

    if (!account) {
      throw new InternalServerErrorException('Failed to create account');
    }

    return {
      message: 'Account created successfully',
    };
  }
}
