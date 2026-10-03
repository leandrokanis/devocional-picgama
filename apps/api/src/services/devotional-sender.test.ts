import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { logger } from '../utils/logger.js';
import { DevotionalService, type DevotionalMessage, type ReadingSource } from './devotional.js';
import {
  DevotionalSender,
  type DevotionalAudioSource,
  type DevotionalMessenger,
  type PublicationRecorder,
  type SendTarget
} from './devotional-sender.js';

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

type Recorded = { date: string; chatId: string; groupName: string };

class FakeRecorder implements PublicationRecorder {
  public recorded: Recorded[] = [];
  public deliveredBeforeEachRecord: string[][] = [];
  public failing = false;

  async record(date: string, target: { chatId: string; groupName: string }): Promise<void> {
    this.deliveredBeforeEachRecord.push(sequence());
    if (this.failing) throw new Error('db down');
    this.recorded.push({ date, ...target });
  }
}

const noReadings: ReadingSource = { get: async () => null };

const group = (chatId: string): SendTarget => ({ chatId, name: `Grupo ${chatId}`, type: 'group' });
const person = (chatId: string): SendTarget => ({ chatId, name: `Pessoa ${chatId}`, type: 'person' });
const groups = (...chatIds: string[]) => chatIds.map(group);

const label = (delivery: Delivery) => {
  if (delivery.kind === 'voice') return `${delivery.chatId}:voice:${delivery.audio}`;
  return `${delivery.chatId}:${delivery.text!.startsWith('Vamos ler a Bíblia hoje?') ? 'reading' : 'devotional'}`;
};

let messenger: FakeMessenger;
let recorder: FakeRecorder;
const sequence = () => messenger.deliveries.map(label);
const senderWith = (audio: Buffer | null) =>
  new DevotionalSender(new DevotionalService(noReadings), new FakeAudioSource(audio), messenger, recorder);

beforeEach(() => {
  messenger = new FakeMessenger();
  recorder = new FakeRecorder();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('DevotionalSender.send', () => {
  test('with title and audio, each recipient gets the reading, then the devotional, then the voice note', async () => {
    const sent = await senderWith(Buffer.from('ogg')).send(devotional(), groups('a', 'b'));
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
    const sent = await senderWith(audio).send(devotional(overrides), groups('a'));
    expect({ sent, sequence: sequence() }).toEqual({ sent: true, sequence: expected });
  });

  test('a recipient whose reading message fails gets neither the devotional nor the voice note, and the others still get all', async () => {
    messenger.failing.push({ chatId: 'a', kind: 'reading' });
    const sent = await senderWith(Buffer.from('ogg')).send(devotional(), groups('a', 'b'));
    expect({ sent, sequence: sequence() }).toEqual({ sent: true, sequence: ['b:reading', 'b:devotional', 'b:voice:ogg'] });
  });

  test('a failed devotional message is logged as a warning and the voice note is still sent', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    messenger.failing.push({ chatId: 'first@g.us', kind: 'devotional' });
    const sent = await senderWith(Buffer.from('ogg')).send(devotional(), groups('first@g.us', 'second@g.us'));
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
    const sent = await senderWith(Buffer.from('ogg')).send(devotional(), groups('first@g.us', 'second@g.us'));
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
    expect(await senderWith(Buffer.from('ogg')).send(devotional(), groups('a', 'b'))).toBe(true);
  });

  test('success counts reading messages: false when no reading message is delivered', async () => {
    for (const chatId of ['a', 'b']) messenger.failing.push({ chatId, kind: 'reading' });
    expect(await senderWith(Buffer.from('ogg')).send(devotional(), groups('a', 'b'))).toBe(false);
  });

  test('reads the audio file once for all recipients', async () => {
    const audioSource = new FakeAudioSource(Buffer.from('ogg'));
    await new DevotionalSender(new DevotionalService(noReadings), audioSource, messenger, recorder).send(devotional(), groups('a', 'b', 'c'));
    expect(audioSource.reads).toBe(1);
  });
});

describe('DevotionalSender.send recording publications', () => {
  test('a group whose reading message is delivered becomes a publication of the devotional date, with the group name', async () => {
    await senderWith(null).send(devotional(), [group('g1@g.us')]);
    expect(recorder.recorded).toEqual([{ date: '2026-10-04', chatId: 'g1@g.us', groupName: 'Grupo g1@g.us' }]);
  });

  test('a person who gets the reading message is not a publication', async () => {
    const sent = await senderWith(null).send(devotional(), [person('p1@s.whatsapp.net')]);
    expect({ sent, recorded: recorder.recorded }).toEqual({ sent: true, recorded: [] });
  });

  test('a group whose reading message fails is not a publication, and each delivered group is recorded once', async () => {
    messenger.failing.push({ chatId: 'g1@g.us', kind: 'reading' });
    await senderWith(Buffer.from('ogg')).send(devotional(), [group('g1@g.us'), person('p1@s.whatsapp.net'), group('g2@g.us')]);
    expect(recorder.recorded).toEqual([{ date: '2026-10-04', chatId: 'g2@g.us', groupName: 'Grupo g2@g.us' }]);
  });

  test('the publication is recorded right after the reading message, before the devotional and the voice note', async () => {
    await senderWith(Buffer.from('ogg')).send(devotional(), groups('g1@g.us', 'g2@g.us'));
    expect(recorder.deliveredBeforeEachRecord).toEqual([
      ['g1@g.us:reading'],
      ['g1@g.us:reading', 'g1@g.us:devotional', 'g1@g.us:voice:ogg', 'g2@g.us:reading']
    ]);
  });

  test('a failing record is logged as an error with date and chat, and the devotional, the voice note and the next groups still go', async () => {
    const error = vi.spyOn(logger, 'error').mockImplementation(() => {});
    recorder.failing = true;
    const sent = await senderWith(Buffer.from('ogg')).send(devotional(), groups('g1@g.us', 'g2@g.us'));
    expect({
      sent,
      sequence: sequence(),
      logged: error.mock.calls.map(([message]) => String(message)).filter((m) => m.includes('2026-10-04') && m.includes('g1@g.us')).length
    }).toEqual({
      sent: true,
      sequence: ['g1@g.us:reading', 'g1@g.us:devotional', 'g1@g.us:voice:ogg', 'g2@g.us:reading', 'g2@g.us:devotional', 'g2@g.us:voice:ogg'],
      logged: 1
    });
  });
});
