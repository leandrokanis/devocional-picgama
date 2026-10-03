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

export type SendResult = { target: SendTarget; delivered: boolean; warnings: string[] };

type SendContent = { date: string; reading: string; devotional: string | null; audio: Buffer | null };

const DEVOTIONAL_FAILED_WARNING = 'A mensagem do devocional não foi entregue; a leitura foi enviada.';
const VOICE_FAILED_WARNING = 'O áudio não foi entregue; a leitura foi enviada.';

export class DevotionalSender {
  constructor(
    private readonly devotionalService: DevotionalService,
    private readonly audioSource: DevotionalAudioSource,
    private readonly messenger: DevotionalMessenger,
    private readonly recorder: PublicationRecorder
  ) {}

  public async send(devotional: DevotionalMessage, targets: SendTarget[]): Promise<boolean> {
    const results = await this.sendEach(devotional, targets);
    return results.some((result) => result.delivered);
  }

  public async sendEach(devotional: DevotionalMessage, targets: SendTarget[]): Promise<SendResult[]> {
    const content: SendContent = {
      date: devotional.date,
      reading: await this.devotionalService.formatReadingMessage(devotional),
      devotional: this.devotionalService.formatDevotionalMessage(devotional),
      audio: await this.audioSource.readFile(devotional.date)
    };
    const results: SendResult[] = [];
    for (const target of targets) results.push(await this.sendTo(target, content));
    return results;
  }

  private async sendTo(target: SendTarget, content: SendContent): Promise<SendResult> {
    const { chatId } = target;
    const readingSent = await this.messenger.sendDevotionalMessage(content.reading, chatId);
    if (!readingSent) return { target, delivered: false, warnings: [] };
    if (target.type === 'group') await this.recordPublication(content.date, target);
    const warnings: string[] = [];
    if (content.devotional && !(await this.messenger.sendDevotionalMessage(content.devotional, chatId))) {
      logger.warn(`Devotional message for ${content.date} failed for ${chatId}; reading was delivered`);
      warnings.push(DEVOTIONAL_FAILED_WARNING);
    }
    if (content.audio && !(await this.messenger.sendVoiceMessage(content.audio, chatId))) {
      logger.warn(`Voice note for ${content.date} failed for ${chatId}; reading was delivered`);
      warnings.push(VOICE_FAILED_WARNING);
    }
    return { target, delivered: true, warnings };
  }

  private async recordPublication(date: string, target: SendTarget): Promise<void> {
    try {
      await this.recorder.record(date, { chatId: target.chatId, groupName: target.name });
    } catch (error) {
      logger.error(`Could not record the publication of ${date} for ${target.chatId}; the group did receive it`, error);
    }
  }
}
