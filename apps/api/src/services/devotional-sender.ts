import { logger } from '../utils/logger.js';
import type { DevotionalMessage, DevotionalService } from './devotional.js';

export interface DevotionalMessenger {
  sendDevotionalMessage(text: string, chatId: string): Promise<boolean>;
  sendVoiceMessage(audio: Buffer, chatId: string): Promise<boolean>;
}

export interface DevotionalAudioSource {
  readFile(date: string): Promise<Buffer | null>;
}

export interface PublicationRecorder {
  record(date: string, target: { chatId: string; groupName: string }): Promise<void>;
}

export type SendTarget = { chatId: string; name: string; type: 'group' | 'person' };

export class DevotionalSender {
  constructor(
    private readonly devotionalService: DevotionalService,
    private readonly audioSource: DevotionalAudioSource,
    private readonly messenger: DevotionalMessenger,
    private readonly recorder: PublicationRecorder
  ) {}

  public async send(devotional: DevotionalMessage, targets: SendTarget[]): Promise<boolean> {
    const audio = await this.audioSource.readFile(devotional.date);
    const readingMessage = await this.devotionalService.formatReadingMessage(devotional);
    const devotionalMessage = this.devotionalService.formatDevotionalMessage(devotional);
    let delivered = 0;
    for (const target of targets) {
      const { chatId } = target;
      const readingSent = await this.messenger.sendDevotionalMessage(readingMessage, chatId);
      if (!readingSent) continue;
      delivered += 1;
      if (target.type === 'group') await this.recordPublication(devotional.date, target);
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

  private async recordPublication(date: string, target: SendTarget): Promise<void> {
    try {
      await this.recorder.record(date, { chatId: target.chatId, groupName: target.name });
    } catch (error) {
      logger.error(`Could not record the publication of ${date} for ${target.chatId}; the group did receive it`, error);
    }
  }
}
