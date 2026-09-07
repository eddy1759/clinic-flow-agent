import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  async health() {
    let database: 'up' | 'down' = 'down';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      database = 'up';
    } catch {
      database = 'down';
    }

    return {
      status: database === 'up' ? 'ok' : 'degraded',
      service: 'clinic-flow-agent',
      timestamp: new Date().toISOString(),
      database,
      integrations: {
        openai: Boolean(this.config.get<string>('OPENAI_API_KEY')),
        googleCalendar: Boolean(this.config.get<string>('GOOGLE_CLIENT_EMAIL') && this.config.get<string>('GOOGLE_PRIVATE_KEY')),
        email: Boolean(this.config.get<string>('SMTP_HOST') && this.config.get<string>('SMTP_USER')),
      },
    };
  }
}
