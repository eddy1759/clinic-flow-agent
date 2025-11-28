import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
  Logger,
  UsePipes,
  ValidationPipe,
  //   UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiProperty,
} from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  Length,
} from 'class-validator';
import { Transform } from 'class-transformer';
// import { ThrottlerGuard } from '@nestjs/throttler'; // Rate limiting
import { AgentService } from '../agent/agent.service';

export class IncomingMessageDto {
  @ApiProperty({
    description: 'Unique identifier (Phone number or Session ID)',
    example: '+14155551234',
  })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim()) // Auto-trim whitespace
  userId: string;

  @ApiProperty({
    description: 'The user natural language message',
    example: 'I need to book an appointment',
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 1000, { message: 'Message must be between 1 and 1000 characters' }) // Prevent massive payloads
  @Transform(({ value }) => value?.trim())
  message: string;

  @ApiProperty({
    description: 'Source channel',
    enum: ['SMS', 'WEB', 'VOICE'],
    default: 'WEB',
    required: false,
  })
  @IsOptional()
  @IsEnum(['SMS', 'WEB', 'VOICE'])
  channel?: 'SMS' | 'WEB' | 'VOICE';
}

// --- 2. Response DTO for Type Safety ---
class ChatResponseDto {
  @ApiProperty()
  status: string;

  @ApiProperty()
  reply: string;

  @ApiProperty()
  timestamp: string;
}

@ApiTags('Messaging')
@Controller('messaging')
export class MessagingController {
  private readonly logger = new Logger(MessagingController.name);

  constructor(private readonly agentService: AgentService) {}

  @Post('chat')
  @ApiOperation({ summary: 'Process a message via the AI Agent' })
  @ApiResponse({
    status: 201,
    description: 'Message processed successfully',
    type: ChatResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 500, description: 'Internal AI processing failed' })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async handleMessage(
    @Body() payload: IncomingMessageDto,
  ): Promise<ChatResponseDto> {
    const startTime = Date.now();

    // Log entry (Audit trail for debugging)
    this.logger.log(
      `Incoming message from User: ${payload.userId} via ${payload.channel || 'WEB'}`,
    );

    try {
      // 1. Delegate to the AI Agent
      const response = await this.agentService.handleMessage(
        payload.userId,
        payload.message,
        payload.channel || 'WEB',
      );

      const duration = Date.now() - startTime;
      this.logger.log(`Request processed successfully in ${duration}ms`);

      // 2. Return standardized, timestamped JSON
      return {
        status: 'success',
        reply: response,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      // 3. Robust Error Handling
      // Log the actual error stack for developers
      this.logger.error(
        `Failed to process message for User: ${payload.userId}`,
        error.stack,
      );

      // Return a sanitized error to the client (Security)
      throw new HttpException(
        {
          status: 'error',
          message:
            'Unable to process your request at this time. Please try again later.',
          error: error.message, // Optional: Remove this in strict production environments
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
