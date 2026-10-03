import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { logger } from '../utils/logger.js';
import { DevotionalService, type DevotionalMessage, type ReadingSource } from './devotional.js';
import { DevotionalSender, type DevotionalAudioSource, type DevotionalMessenger } from './devotional-sender.js';

const TITLE = '04/10: Quando uma criança fica no meio da roda (Mateus 16-18)';

const devotional = (overrides: Partial<DevotionalMessage> = {}): DevotionalMessage => ({
  date: '2026-10-04',
  formattedDate: '04/10/2026',
  passage: 'Mateus 16-18',
  title: TITLE,
  description: 'Uma descrição',
  link: 'https://open.spotify.com/episode/x',
  ...overrides
});

type Delivery = { kind: 'text' | 'voice'; chatId: string; text?: string; audio?: Buffer };

class FakeMessenger implements DevotionalMessenger {
  public deliveries: Delivery[] = [];
  public failing: { chatId: string; kind: 'reading' | 'devotional' | 'voice' }[] = [];

  private fails(chatId: string, kind: 'reading' | 'devotional' | 'voice') {
    return this.failing.some((failure) => failure.chatId === chatId && failure.kind === kind);
  }

  async sendDevotionalMessage(text: string, chatId: string): Promise<boolean> {
    const kind = text.startsWith('Vamos ler a Bíblia hoje?') ? 'reading' : 'devotional';
    if (this.fails(chatId, kind)) return false;
    this.deliveries.push({ kind: 'text', chatId, text });
    return true;
  }

  async sendVoiceMessage(audio: Buffer, chatId: string): Promise<boolean> {
    if (this.fails(chatId, 'voice')) return false;
    this.deliveries.push({ kind: 'voice', chatId, audio });
    return true;
  }
}

class FakeAudioSource implements DevotionalAudioSource {
  public reads = 0;
  constructor(private readonly audio: Buffer | null) {}

  async readFile(): Promise<Buffer | null> {
    this.reads += 1;
    return this.audio;
  }
}

const noReadings: ReadingSource = { get: async () => null };

const label = (delivery: Delivery) => {
  if (delivery.kind === 'voice') return `${delivery.chatId}:voice:${delivery.audio}`;
  return `${delivery.chatId}:${delivery.text!.startsWith('Vamos ler a Bíblia hoje?') ? 'reading' : 'devotional'}`;
};

let messenger: FakeMessenger;
const sequence = () => messenger.deliveries.map(label);
const senderWith = (audio: Buffer | null) =>
  new DevotionalSender(new DevotionalService(noReadings), new FakeAudioSource(audio), messenger);

beforeEach(() => {
  messenger = new FakeMessenger();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('DevotionalSender.send', () => {
  test('with title and audio, each recipient gets the reading, then the devotional, then the voice note', async () => {
    const sent = await senderWith(Buffer.from('ogg')).send(devotional(), ['a', 'b']);
    expect({ sent, sequence: sequence() }).toEqual({
      sent: true,
      sequence: ['a:reading', 'a:devotional', 'a:voice:ogg', 'b:reading', 'b:devotional', 'b:voice:ogg']
    });
  });

  test.each([
    { label: 'title without audio', overrides: {}, audio: null, expected: ['a:reading', 'a:devotional'] },
    { label: 'audio without title', overrides: { title: '' }, audio: Buffer.from('ogg'), expected: ['a:reading', 'a:voice:ogg'] },
    { label: 'neither title nor audio', overrides: { title: '' }, audio: null, expected: ['a:reading'] }
  ])('with $label, the recipient gets $expected', async ({ overrides, audio, expected }) => {
    const sent = await senderWith(audio).send(devotional(overrides), ['a']);
    expect({ sent, sequence: sequence() }).toEqual({ sent: true, sequence: expected });
  });

  test('a recipient whose reading message fails gets neither the devotional nor the voice note, and the others still get all', async () => {
    messenger.failing.push({ chatId: 'a', kind: 'reading' });
    const sent = await senderWith(Buffer.from('ogg')).send(devotional(), ['a', 'b']);
    expect({ sent, sequence: sequence() }).toEqual({ sent: true, sequence: ['b:reading', 'b:devotional', 'b:voice:ogg'] });
  });

  test('a failed devotional message is logged as a warning and the voice note is still sent', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    messenger.failing.push({ chatId: 'first@g.us', kind: 'devotional' });
    const sent = await senderWith(Buffer.from('ogg')).send(devotional(), ['first@g.us', 'second@g.us']);
    expect({
      sent,
      sequence: sequence(),
      warned: warn.mock.calls.some(([message]) => String(message).includes('first@g.us'))
    }).toEqual({
      sent: true,
      sequence: ['first@g.us:reading', 'first@g.us:voice:ogg', 'second@g.us:reading', 'second@g.us:devotional', 'second@g.us:voice:ogg'],
      warned: true
    });
  });

  test('a failed voice note is logged as a warning, nothing is resent and the others still get everything', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    messenger.failing.push({ chatId: 'first@g.us', kind: 'voice' });
    const sent = await senderWith(Buffer.from('ogg')).send(devotional(), ['first@g.us', 'second@g.us']);
    expect({
      sent,
      sequence: sequence(),
      warned: warn.mock.calls.some(([message]) => String(message).includes('first@g.us'))
    }).toEqual({
      sent: true,
      sequence: ['first@g.us:reading', 'first@g.us:devotional', 'second@g.us:reading', 'second@g.us:devotional', 'second@g.us:voice:ogg'],
      warned: true
    });
  });

  test('success counts reading messages: true when every devotional message and voice note fails', async () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    for (const chatId of ['a', 'b']) messenger.failing.push({ chatId, kind: 'devotional' }, { chatId, kind: 'voice' });
    expect(await senderWith(Buffer.from('ogg')).send(devotional(), ['a', 'b'])).toBe(true);
  });

  test('success counts reading messages: false when no reading message is delivered', async () => {
    for (const chatId of ['a', 'b']) messenger.failing.push({ chatId, kind: 'reading' });
    expect(await senderWith(Buffer.from('ogg')).send(devotional(), ['a', 'b'])).toBe(false);
  });

  test('reads the audio file once for all recipients', async () => {
    const audioSource = new FakeAudioSource(Buffer.from('ogg'));
    await new DevotionalSender(new DevotionalService(noReadings), audioSource, messenger).send(devotional(), ['a', 'b', 'c']);
    expect(audioSource.reads).toBe(1);
  });
});
