import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { ManualSendResult } from '@devocional/shared';
import { logger } from '../utils/logger.js';
import { DevotionalService, type DevotionalMessage } from './devotional.js';
import {
  DevotionalSender,
  type DevotionalAudioSource,
  type DevotionalMessenger,
  type PublicationRecorder
} from './devotional-sender.js';
import {
  ManualSendService,
  NoRecipientsSelectedError,
  ReadingNotFoundError,
  WhatsAppDisconnectedError,
  type ManualSendConnection,
  type ManualSendReadings,
  type ManualSendRecipients
} from './manual-send.js';
import type { Recipient } from './recipients.js';

type Delivery = { kind: 'reading' | 'devotional' | 'voice'; chatId: string; text?: string };

class FakeMessenger implements DevotionalMessenger {
  public deliveries: Delivery[] = [];
  public failing: { chatId: string; kind: Delivery['kind'] }[] = [];

  private fails(chatId: string, kind: Delivery['kind']) {
    return this.failing.some((failure) => failure.chatId === chatId && failure.kind === kind);
  }

  async sendDevotionalMessage(text: string, chatId: string): Promise<boolean> {
    const kind = text.startsWith('Vamos ler a Bíblia hoje?') ? 'reading' : 'devotional';
    if (this.fails(chatId, kind)) return false;
    this.deliveries.push({ kind, chatId, text });
    return true;
  }

  async sendVoiceMessage(_audio: Buffer, chatId: string): Promise<boolean> {
    if (this.fails(chatId, 'voice')) return false;
    this.deliveries.push({ kind: 'voice', chatId });
    return true;
  }
}

class FakeRecorder implements PublicationRecorder {
  public recorded: { date: string; chatId: string; groupName: string }[] = [];
  async record(date: string, target: { chatId: string; groupName: string }): Promise<void> {
    this.recorded.push({ date, ...target });
  }
}

const recipient = (id: number, type: Recipient['type'] = 'person'): Recipient => ({
  id,
  chatId: `chat-${id}`,
  name: `Destinatário ${id}`,
  type,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
});

const READING: DevotionalMessage = {
  date: '2026-10-10',
  formattedDate: '10/10/2026',
  passage: 'Lucas 1',
  title: 'Um título',
  description: 'Uma descrição',
  link: 'https://open.spotify.com/episode/x'
};

let messenger: FakeMessenger;
let recorder: FakeRecorder;
let connected: boolean;
let stored: Recipient[];
let readingsByDate: Record<string, DevotionalMessage>;

const connection: ManualSendConnection = { getConnectionStatus: () => connected };
const recipients: ManualSendRecipients = { getById: async (id) => stored.find((r) => r.id === id) ?? null };
const readings: ManualSendReadings = { getReading: async (date) => readingsByDate[date] ?? null };
const audio = (buffer: Buffer | null): DevotionalAudioSource => ({ readFile: async () => buffer });

const service = (audioBuffer: Buffer | null = Buffer.from('ogg')) =>
  new ManualSendService(
    connection,
    readings,
    recipients,
    new DevotionalSender(new DevotionalService({ get: async () => null }), audio(audioBuffer), messenger, recorder)
  );

beforeEach(() => {
  messenger = new FakeMessenger();
  recorder = new FakeRecorder();
  connected = true;
  stored = [recipient(1), recipient(2), recipient(3)];
  readingsByDate = { '2026-10-10': READING };
  vi.spyOn(logger, 'warn').mockImplementation(() => {});
});

describe('ManualSendService.send', () => {
  test('only the selected recipients get the reading, the devotional and the voice note of that date', async () => {
    await service().send('2026-10-10', [1, 3]);
    expect(messenger.deliveries.map(({ kind, chatId }) => `${chatId}:${kind}`)).toEqual([
      'chat-1:reading',
      'chat-1:devotional',
      'chat-1:voice',
      'chat-3:reading',
      'chat-3:devotional',
      'chat-3:voice'
    ]);
  });

  test('returns one result per recipient, in the order requested, with the recipient name', async () => {
    expect(await service().send('2026-10-10', [3, 1])).toEqual<ManualSendResult[]>([
      { recipientId: 3, name: 'Destinatário 3', status: 'sent', warnings: [] },
      { recipientId: 1, name: 'Destinatário 1', status: 'sent', warnings: [] }
    ]);
  });

  test('a recipient whose reading is not delivered is failed with a reason, and the others still receive it', async () => {
    messenger.failing.push({ chatId: 'chat-1', kind: 'reading' });
    const results = await service().send('2026-10-10', [1, 2]);
    expect(results.map(({ recipientId, status, error }) => ({ recipientId, status, hasError: Boolean(error?.trim()) }))).toEqual([
      { recipientId: 1, status: 'failed', hasError: true },
      { recipientId: 2, status: 'sent', hasError: false }
    ]);
  });

  test('a recipient who gets the reading but not the voice note is sent with warnings', async () => {
    messenger.failing.push({ chatId: 'chat-2', kind: 'voice' });
    const results = await service().send('2026-10-10', [1, 2]);
    expect(results.map(({ recipientId, status, warnings }) => ({ recipientId, status, warned: warnings.some((w) => w.trim() !== '') }))).toEqual([
      { recipientId: 1, status: 'sent', warned: false },
      { recipientId: 2, status: 'sent_with_warnings', warned: true }
    ]);
  });

  test('a recipient that no longer exists is failed as not found, in its place, and the others still receive it', async () => {
    const results = await service().send('2026-10-10', [1, 99, 2]);
    expect({ results, chats: messenger.deliveries.filter((d) => d.kind === 'reading').map((d) => d.chatId) }).toEqual({
      results: [
        { recipientId: 1, name: 'Destinatário 1', status: 'sent', warnings: [] },
        { recipientId: 99, name: '', status: 'failed', warnings: [], error: 'Destinatário não encontrado' },
        { recipientId: 2, name: 'Destinatário 2', status: 'sent', warnings: [] }
      ],
      chats: ['chat-1', 'chat-2']
    });
  });

  test('a recipient selected twice gets the reading once and appears once in the result', async () => {
    const results = await service(null).send('2026-10-10', [2, 1, 2]);
    expect({
      results: results.map((r) => r.recipientId),
      readings: messenger.deliveries.filter((d) => d.kind === 'reading').map((d) => d.chatId)
    }).toEqual({ results: [2, 1], readings: ['chat-2', 'chat-1'] });
  });

  test('an empty selection is refused and nothing is sent', async () => {
    const outcome = await service().send('2026-10-10', []).catch((error: unknown) => error);
    expect({ refused: outcome instanceof NoRecipientsSelectedError, deliveries: messenger.deliveries }).toEqual({ refused: true, deliveries: [] });
  });

  test('with WhatsApp disconnected the send is refused before any message goes out', async () => {
    connected = false;
    const outcome = await service().send('2026-10-10', [1, 2]).catch((error: unknown) => error);
    expect({ refused: outcome instanceof WhatsAppDisconnectedError, deliveries: messenger.deliveries }).toEqual({ refused: true, deliveries: [] });
  });

  test('a date without a reading is refused as not found and nothing is sent', async () => {
    const outcome = await service().send('2026-12-25', [1]).catch((error: unknown) => error);
    expect({ refused: outcome instanceof ReadingNotFoundError, deliveries: messenger.deliveries }).toEqual({ refused: true, deliveries: [] });
  });

  test('a selected group that receives the reading becomes a publication of the reading date; a person does not', async () => {
    stored = [recipient(1, 'group'), recipient(2, 'person')];
    await service().send('2026-10-10', [1, 2]);
    expect(recorder.recorded).toEqual([{ date: '2026-10-10', chatId: 'chat-1', groupName: 'Destinatário 1' }]);
  });

  test('the reading message carries the date of the reading, not the day of the send', async () => {
    await service(null).send('2026-10-10', [1]);
    expect(messenger.deliveries.find((d) => d.kind === 'reading')?.text).toContain('Leitura de hoje - 10/10/2026');
  });
});
