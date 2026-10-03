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
    const readingMessage = await this.devotionalService.formatReadingMessage(devotional);
    const devotionalMessage = this.devotionalService.formatDevotionalMessage(devotional);
    let delivered = 0;
    for (const chatId of chatIds) {
      const readingSent = await this.messenger.sendDevotionalMessage(readingMessage, chatId);
      if (!readingSent) continue;
      delivered += 1;
      if (devotionalMessage) {
        const devotionalSent = await this.messenger.sendDevotionalMessage(devotionalMessage, chatId);
        if (!devotionalSent) logger.warn(`Devotional message for ${devotional.date} failed for ${chatId}; reading was delivered`);
      }
      if (!audio) continue;
      const voiceSent = await this.messenger.sendVoiceMessage(audio, chatId);
      if (!voiceSent) logger.warn(`Voice note for ${devotional.date} failed for ${chatId}; reading was delivered`);
    }
    return delivered > 0;
  }
}
