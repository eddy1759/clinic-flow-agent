import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Res,
  HttpStatus,
  Logger,
  Get,
  Param,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { AgentService } from '../agent/agent.service';
import { VoiceService } from './voice.service';

@Controller('voice')
export class VoiceController {
  private readonly logger = new Logger(VoiceController.name);

  constructor(
    private agent: AgentService,
    private voice: VoiceService,
  ) {}

  @Post('chat') // Endpoint: POST /api/v1/voice/chat
  @UseInterceptors(FileInterceptor('audio')) // Expects form-data field "audio"
  async handleVoiceChat(
    @UploadedFile() file: Express.Multer.File,
    @Res() res: Response,
  ) {
    if (!file) return res.status(HttpStatus.BAD_REQUEST).send('No audio file');

    try {
      // 1. STT: Convert Audio -> Text (Whisper)
      const userText = await this.voice.transcribeBuffer(file.buffer);
      this.logger.log(`🗣️ User said: "${userText}"`);

      // 2. LLM: Process logic (Same brain as Text Chat)
      // Use a dummy ID for web voice users, or pass a header
      const aiResponse = await this.agent.handleMessage(
        'voice-user',
        userText,
        'VOICE',
      );
      this.logger.log(`🤖 Agent replied: "${aiResponse}"`);

      // 3. TTS: Convert Text -> Audio (OpenAI)
      const audioId = await this.voice.generateAudio(aiResponse);

      // 4. Return JSON
      return res.json({
        text: aiResponse,
        audioUrl: `/api/v1/voice/audio/${audioId}`,
      });
    } catch (e) {
      this.logger.error(e);
      return res.status(500).send(e.message);
    }
  }

  @Get('audio/:id')
  async getAudio(@Param('id') id: string, @Res() res: Response) {
    const audioBuffer = this.voice.getAudioStream(id);

    if (!audioBuffer) {
      return res.status(HttpStatus.NOT_FOUND).send('Audio not found');
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', audioBuffer.length);
    res.send(audioBuffer);
  }
}
