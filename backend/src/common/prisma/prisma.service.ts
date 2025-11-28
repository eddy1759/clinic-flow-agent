import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(private readonly config: ConfigService) {
    // 1. Create a standard Postgres Pool using the URL from .env
    const connectionString = config.get<string>('DATABASE_URL');

    const pool = new Pool({
      connectionString,
      // Optional: standard pg config
      max: 10, // connection pool size
      idleTimeoutMillis: 30000,
    });

    // 2. Create the Prisma Adapter
    const adapter = new PrismaPg(pool);

    // 3. Pass the adapter to the super class
    super({
      adapter, // <--- This satisfies the "Using engine type 'client' requires 'adapter'" error
      log: [
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
      ],
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Prisma (v7 Adapter) connected successfully');
    } catch (error) {
      this.logger.error('Failed to connect to Prisma', error);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Prisma disconnected');
  }
}
