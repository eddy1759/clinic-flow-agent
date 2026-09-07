import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { AgentService } from 'src/agent/agent.service';
import { VoiceService } from 'src/voice/voice.service';

const websocketOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

@WebSocketGateway({
  cors: { origin: websocketOrigins, credentials: true },
  namespace: 'events',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly agentService: AgentService,
    private readonly voiceService: VoiceService,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log({ event: 'SOCKET_CONNECTED', clientId: client.id });
  }

  handleDisconnect(client: Socket) {
    this.logger.log({ event: 'SOCKET_DISCONNECTED', clientId: client.id });
  }

  @SubscribeMessage('user_text')
  async handleText(
    @MessageBody() payload: { userId: string; text: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.log({
      event: 'TEXT_RECEIVED',
      clientId: client.id,
      characters: payload.text?.length ?? 0,
    });
    client.emit('bot_status', { status: 'thinking' });

    try {
      const responseText = await this.agentService.handleMessage(
        payload.userId,
        payload.text,
        'WEB',
      );

      client.emit('bot_response', {
        type: 'text',
        text: responseText,
        audioUrl: null,
      });
    } catch (error) {
      this.handleError(client, error);
    } finally {
      client.emit('bot_status', { status: 'idle' });
    }
  }

  @SubscribeMessage('user_voice')
  async handleVoice(
    @MessageBody() payload: { userId: string; audio: Buffer },
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.log({
      event: 'VOICE_RECEIVED',
      clientId: client.id,
      bytes: (payload.audio as any)?.length ?? 0,
    });
    client.emit('bot_status', { status: 'transcribing' });

    try {
      if (!payload.audio || (payload.audio as any).length < 1000) {
        this.logger.warn({ event: 'VOICE_TOO_SHORT', clientId: client.id });
        client.emit('bot_status', { status: 'idle' });
        return;
      }

      const transcript = await this.voiceService.transcribeBuffer(
        Buffer.from(payload.audio),
      );

      if (this.checkHallucination(transcript)) {
        client.emit('bot_status', { status: 'idle' });
        return;
      }

      client.emit('user_transcript', { text: transcript });
      client.emit('bot_status', { status: 'thinking' });

      const responseText = await this.agentService.handleMessage(
        payload.userId,
        transcript,
        'VOICE',
      );

      client.emit('bot_status', { status: 'speaking' });
      const audioId = await this.voiceService.generateAudio(responseText);

      client.emit('bot_response', {
        type: 'voice',
        text: responseText,
        audioUrl: `/api/v1/voice/audio/${audioId}`,
      });
    } catch (error) {
      this.handleError(client, error);
    } finally {
      client.emit('bot_status', { status: 'idle' });
    }
  }

  private handleError(client: Socket, error: any) {
    this.logger.error({
      event: 'SOCKET_PROCESSING_FAILED',
      clientId: client.id,
      message: error?.message ?? 'Unknown error',
    });
    client.emit('error_message', {
      message:
        'Something went wrong processing your request. Please try again.',
    });
  }

  private checkHallucination(text: string): boolean {
    const lower = text.toLowerCase().trim();
    const badPhrases = [
      'visit www.fema.gov',
      'subtitles by',
      'amara.org',
      'captioned by',
    ];

    if (badPhrases.some((p) => lower.includes(p)) || lower.length < 2) {
      this.logger.warn({
        event: 'TRANSCRIPT_REJECTED',
        reason: 'known_hallucination_or_empty',
      });
      return true;
    }
    return false;
  }
}
