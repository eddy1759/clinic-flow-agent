import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { randomUUID } from 'crypto';

@Injectable()
export class VoiceService {
  private openai: OpenAI;
  private readonly logger = new Logger(VoiceService.name);

  // In-memory cache to store generated audio files for a short time (1 min)
  // We use RAM instead of Disk for speed and HIPAA compliance (transient data)
  private audioCache = new Map<string, Buffer>();
  private readonly MAX_VOICE_CHARS = 500;

  constructor(private config: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.config.get<string>('OPENAI_API_KEY'),
    });
  }

  /**
   * 1. SPEECH-TO-TEXT (STT)
   * Converts a raw audio buffer (from upload) into text using Whisper.
   */
  async transcribeBuffer(audioBuffer: Buffer): Promise<string> {
    try {
      // Convert Buffer to a "File-like" object that OpenAI SDK accepts
      // We name it 'speech.webm' because browsers usually send WebM audio
      const file = await OpenAI.toFile(audioBuffer, 'speech.webm', {
        type: 'audio/webm',
      });

      const transcription = await this.openai.audio.transcriptions.create({
        file: file,
        model: 'whisper-1',
        language: 'en', // Optimization: Force English for faster processing
        prompt: 'Medical appointment context. Patient speaking.', // Context hint helps accuracy
      });

      const rawText = transcription.text;

      if (rawText.length > this.MAX_VOICE_CHARS) {
        this.logger.warn(`Voice input exceeded length: ${rawText.length}`);
        throw new BadRequestException(
          'Voice message is too long. Please be brief.',
        );
      }

      // 3. SANITIZATION: Content Moderation (OpenAI Moderation API)
      // This checks for Hate, Self-Harm, Sexual, Violence, etc.
      const moderation = await this.openai.moderations.create({
        input: rawText,
      });

      const result = moderation.results[0];
      if (result.flagged) {
        // Log the category causing the flag for audit (but don't log the text if it's illegal content)
        const categories = Object.keys(result.categories).filter(
          (cat) => result.categories[cat],
        );
        this.logger.warn(`Voice content flagged: ${categories.join(', ')}`);
        throw new BadRequestException(
          'Message content violated safety policies.',
        );
      }

      // 4. Return Clean Text
      return rawText;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;

      this.logger.error('Voice Processing Failed', error);
      throw new Error('Could not process audio input');
    }
  }

  /**
   * 2. TEXT-TO-SPEECH (TTS)
   * Converts AI text response into an MP3 audio buffer.
   * Returns a UUID key to retrieve the file.
   */
  async generateAudio(text: string): Promise<string> {
    try {
      const mp3 = await this.openai.audio.speech.create({
        model: 'tts-1', // 'tts-1' is optimized for low latency (vs tts-1-hd)
        voice: 'shimmer', // A clear, professional female voice
        input: text,
      });

      // Convert response to Buffer
      const buffer = Buffer.from(await mp3.arrayBuffer());

      // Generate a unique ID
      const id = randomUUID();

      // Store in memory
      this.audioCache.set(id, buffer);

      // Auto-delete after 60 seconds to free up RAM
      setTimeout(() => {
        this.audioCache.delete(id);
      }, 60000);

      return id;
    } catch (error) {
      this.logger.error('TTS Generation Failed', error);
      throw new Error('Could not generate voice response');
    }
  }

  /**
   * 3. RETRIEVE AUDIO
   * Used by the GET /voice/audio/:id endpoint to stream the file
   */
  getAudioStream(id: string): Buffer | null {
    return this.audioCache.get(id) || null;
  }
}
