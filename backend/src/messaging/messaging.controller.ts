import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiProperty,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { AgentService } from '../agent/agent.service';

export class IncomingMessageDto {
  @ApiProperty({
    description: 'Unique identifier (phone number or session ID)',
    example: '+14155551234',
  })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  userId: string;

  @ApiProperty({
    description: 'Natural-language message for the receptionist agent',
    example: 'I need to book an appointment',
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 1000, { message: 'Message must be between 1 and 1000 characters' })
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
  @ApiOperation({ summary: 'Process a text message through the receptionist agent' })
  @ApiResponse({
    status: 201,
    description: 'Message processed successfully',
    type: ChatResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 500, description: 'AI processing failed' })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async handleMessage(
    @Body() payload: IncomingMessageDto,
  ): Promise<ChatResponseDto> {
    const startTime = Date.now();
    const channel = payload.channel || 'WEB';
    this.logger.log({
      event: 'MESSAGE_REQUEST_RECEIVED',
      channel,
      characters: payload.message.length,
    });

    try {
      const response = await this.agentService.handleMessage(
        payload.userId,
        payload.message,
        channel,
      );

      this.logger.log({
        event: 'MESSAGE_REQUEST_COMPLETED',
        channel,
        durationMs: Date.now() - startTime,
      });

      return {
        status: 'success',
        reply: response,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error({
        event: 'MESSAGE_REQUEST_FAILED',
        channel,
        durationMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new HttpException(
        {
          status: 'error',
          message: 'Unable to process your request at this time. Please try again later.',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
