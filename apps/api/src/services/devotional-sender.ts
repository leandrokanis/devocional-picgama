import { logger } from '../utils/logger.js';
import type { DevotionalMessage, DevotionalService } from './devotional.js';

export interface DevotionalMessenger {
  sendDevotionalMessage(text: string, chatId: string): Promise<boolean>;
  sendVoiceMessage(audio: Buffer, chatId: string): Promise<boolean>;
}

export interface DevotionalAudioSource {
  readFile(date: string): Promise<Buffer | null>;
}

export class DevotionalSender {
  constructor(
    private readonly devotionalService: DevotionalService,
    private readonly audioSource: DevotionalAudioSource,
    private readonly messenger: DevotionalMessenger
  ) {}

  public async send(devotional: DevotionalMessage, chatIds: string[]): Promise<boolean> {
    const audio = await this.audioSource.readFile(devotional.date);
    const message = await this.devotionalService.formatMessage(devotional, { hasAudio: audio !== null });
    let delivered = 0;
    for (const chatId of chatIds) {
      const textSent = await this.messenger.sendDevotionalMessage(message, chatId);
      if (!textSent) continue;
      delivered += 1;
      if (!audio) continue;
      const voiceSent = await this.messenger.sendVoiceMessage(audio, chatId);
      if (!voiceSent) logger.warn(`Voice note for ${devotional.date} failed for ${chatId}; text was delivered`);
    }
    return delivered > 0;
  }
}
