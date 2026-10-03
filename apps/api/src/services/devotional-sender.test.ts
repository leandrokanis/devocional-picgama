import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { unlinkSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { logger } from '../utils/logger.js';
import { DevotionalService, type DevotionalMessage } from './devotional.js';
import { DevotionalSender, type DevotionalAudioSource, type DevotionalMessenger } from './devotional-sender.js';

const devotional: DevotionalMessage = { date: '2026-01-02', formattedDate: '02/01/2026', reading: 'Gênesis 4-6' };
const AUDIO_LINE = '🎧 Devocional em áudio';

type Delivery = { kind: 'text' | 'voice'; chatId: string; text?: string; audio?: Buffer };

class FakeMessenger implements DevotionalMessenger {
  public deliveries: Delivery[] = [];
  public failingText = new Set<string>();
  public failingVoice = new Set<string>();

  async sendDevotionalMessage(text: string, chatId: string): Promise<boolean> {
    if (this.failingText.has(chatId)) return false;
    this.deliveries.push({ kind: 'text', chatId, text });
    return true;
  }

  async sendVoiceMessage(audio: Buffer, chatId: string): Promise<boolean> {
    if (this.failingVoice.has(chatId)) return false;
    this.deliveries.push({ kind: 'voice', chatId, audio });
    return true;
  }
}

class FakeAudioSource implements DevotionalAudioSource {
  public reads = 0;
  constructor(private readonly audio: Buffer | null, private readonly registered = audio !== null) {}

  async get(date: string) {
    return this.registered ? { originalName: `${date}.mp3`, sizeBytes: 3, updatedAt: new Date() } : null;
  }

  async readFile(): Promise<Buffer | null> {
    this.reads += 1;
    return this.audio;
  }
}

const summary = (messenger: FakeMessenger) =>
  messenger.deliveries.map((d) => (d.kind === 'text' ? `text:${d.chatId}:${d.text!.includes(AUDIO_LINE) ? '🎧' : 'no-🎧'}` : `voice:${d.chatId}:${d.audio}`));

let readingsPath: string;
let devotionalService: DevotionalService;
let messenger: FakeMessenger;

const senderWith = (audioSource: FakeAudioSource) => new DevotionalSender(devotionalService, audioSource, messenger);

beforeEach(() => {
  readingsPath = path.join(tmpdir(), `devocional-sender-${crypto.randomUUID()}.json`);
  writeFileSync(readingsPath, JSON.stringify([{ date: devotional.date, reading: devotional.reading }]));
  devotionalService = new DevotionalService(readingsPath);
  messenger = new FakeMessenger();
});

afterEach(() => {
  vi.restoreAllMocks();
  unlinkSync(readingsPath);
});

describe('DevotionalSender.send', () => {
  test('with audio, each recipient gets the text without the 🎧 line and then the voice note', async () => {
    const sent = await senderWith(new FakeAudioSource(Buffer.from('ogg'))).send(devotional, ['a', 'b']);
    expect({ sent, deliveries: summary(messenger) }).toEqual({
      sent: true,
      deliveries: ['text:a:no-🎧', 'voice:a:ogg', 'text:b:no-🎧', 'voice:b:ogg']
    });
  });

  test('without audio, each recipient gets only today\'s text with the 🎧 line', async () => {
    const sent = await senderWith(new FakeAudioSource(null)).send(devotional, ['a', 'b']);
    expect({ sent, deliveries: summary(messenger) }).toEqual({ sent: true, deliveries: ['text:a:🎧', 'text:b:🎧'] });
  });

  test('when the audio is registered but its file is gone, it sends only the text with the 🎧 line', async () => {
    const sent = await senderWith(new FakeAudioSource(null, true)).send(devotional, ['a']);
    expect({ sent, deliveries: summary(messenger) }).toEqual({ sent: true, deliveries: ['text:a:🎧'] });
  });

  test('a recipient whose text fails gets no voice note, and the others still receive both', async () => {
    messenger.failingText.add('a');
    const sent = await senderWith(new FakeAudioSource(Buffer.from('ogg'))).send(devotional, ['a', 'b']);
    expect({ sent, deliveries: summary(messenger) }).toEqual({ sent: true, deliveries: ['text:b:no-🎧', 'voice:b:ogg'] });
  });

  test('a failed voice note is logged as a warning, the text is not resent and the others still receive both', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    messenger.failingVoice.add('first@g.us');
    const sent = await senderWith(new FakeAudioSource(Buffer.from('ogg'))).send(devotional, ['first@g.us', 'second@g.us']);
    expect({
      sent,
      deliveries: summary(messenger),
      warned: warn.mock.calls.some(([message]) => String(message).includes('first@g.us'))
    }).toEqual({
      sent: true,
      deliveries: ['text:first@g.us:no-🎧', 'text:second@g.us:no-🎧', 'voice:second@g.us:ogg'],
      warned: true
    });
  });

  test('success counts delivered texts: true when every voice note fails but texts arrive', async () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    messenger.failingVoice.add('a').add('b');
    expect(await senderWith(new FakeAudioSource(Buffer.from('ogg'))).send(devotional, ['a', 'b'])).toBe(true);
  });

  test('success counts delivered texts: false when no text is delivered', async () => {
    messenger.failingText.add('a').add('b');
    expect(await senderWith(new FakeAudioSource(Buffer.from('ogg'))).send(devotional, ['a', 'b'])).toBe(false);
  });

  test('sending to a single recipient follows the same text → voice note path', async () => {
    const sent = await senderWith(new FakeAudioSource(Buffer.from('ogg'))).send(devotional, ['only']);
    expect({ sent, deliveries: summary(messenger) }).toEqual({ sent: true, deliveries: ['text:only:no-🎧', 'voice:only:ogg'] });
  });

  test('reads the audio file once for all recipients', async () => {
    const audioSource = new FakeAudioSource(Buffer.from('ogg'));
    await senderWith(audioSource).send(devotional, ['a', 'b', 'c']);
    expect(audioSource.reads).toBe(1);
  });
});
