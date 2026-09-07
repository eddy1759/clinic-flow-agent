import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SecurityService } from './security/security.service';
import { MessagingController } from './messaging/messaging.controller';
import { SchedulingService } from './scheduling/scheduling.service';
import { PrismaService } from './common/prisma/prisma.service';
import { AgentService } from './agent/agent.service';
import { EmailService } from './common/email/email.service';
import { VoiceController } from './voice/voice.controller';
import { VoiceService } from './voice/voice.service';
import { ChatGateway } from './chat/chat.gateway';
import { HealthController } from './health/health.controller';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [MessagingController, VoiceController, HealthController],
  providers: [
    SecurityService,
    PrismaService,
    SchedulingService,
    AgentService,
    EmailService,
    VoiceService,
    ChatGateway,
  ],
})
export class AppModule {}
