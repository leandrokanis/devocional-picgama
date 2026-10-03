import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import path from 'path';
import type { AudioConverter } from './audio-converter.js';
import { AudioService } from './audio.js';
import { DevotionalService, type DevotionalMessage } from './devotional.js';
import { PublicationsService } from './publications.js';
import { ReadingsService } from './readings.js';
import { createTestDatabase, type TestDatabase } from './test-db.js';

const TITLE = '04/10: Quando uma criança fica no meio da roda (Mateus 16-18)';

const unusedConverter: AudioConverter = {
  toVoiceNote: async () => {
    throw new Error('not used');
  }
};

let db: TestDatabase;
let readings: ReadingsService;
let service: DevotionalService;

beforeEach(() => {
  db = createTestDatabase();
  readings = new ReadingsService(
    db.prisma,
    new AudioService(db.prisma, unusedConverter, path.join(db.dir, 'audio'), 1024),
    new PublicationsService(db.prisma)
  );
  service = new DevotionalService(readings);
});

afterEach(async () => {
  await db.cleanup();
});

describe('DevotionalService.getReadingForDate', () => {
  test('reads the reading of that day from the database', async () => {
    await readings.create({ date: '2026-10-04', passage: 'Mateus 16-18', title: TITLE, description: 'd', link: 'l' });
    expect(await service.getReadingForDate(new Date(2026, 9, 4, 6, 0, 0))).toEqual<DevotionalMessage>({
      date: '2026-10-04',
      formattedDate: '04/10/2026',
      passage: 'Mateus 16-18',
      title: TITLE,
      description: 'd',
      link: 'l'
    });
  });

  test('returns null on a day without a reading', async () => {
    expect(await service.getReadingForDate(new Date(2026, 9, 4, 6, 0, 0))).toBeNull();
  });

  test('an edit made between two sends is what the next send reads, without restarting', async () => {
    await readings.create({ date: '2026-10-04', passage: 'Mateus 16-18', title: 'Antigo' });
    await service.getReadingForDate(new Date(2026, 9, 4, 6, 0, 0));
    await readings.update('2026-10-04', { passage: 'Mateus 17', title: TITLE });
    expect(await service.getReadingForDate(new Date(2026, 9, 4, 6, 0, 0))).toMatchObject({ passage: 'Mateus 17', title: TITLE });
  });
});

describe('DevotionalService.getReading', () => {
  const originalTz = process.env.TZ;

  afterEach(() => {
    process.env.TZ = originalTz;
  });

  test('builds the message of the reading of that date, with the date taken from the string even in a negative time zone', async () => {
    process.env.TZ = 'America/Sao_Paulo';
    await readings.create({ date: '2026-01-01', passage: 'Gênesis 1-3', title: TITLE, description: 'd', link: 'l' });
    expect(await service.getReading('2026-01-01')).toEqual<DevotionalMessage>({
      date: '2026-01-01',
      formattedDate: '01/01/2026',
      passage: 'Gênesis 1-3',
      title: TITLE,
      description: 'd',
      link: 'l'
    });
  });

  test('returns null for a date without a reading', async () => {
    expect(await service.getReading('2026-01-01')).toBeNull();
  });
});

const SHORT = 'https://is.gd/short';

class FakeShortener {
  public requested: string[] = [];
  async shorten(url: string): Promise<string> {
    this.requested.push(url);
    return SHORT;
  }
}

const devotional = (overrides: Partial<DevotionalMessage> = {}): DevotionalMessage => ({
  date: '2026-10-04',
  formattedDate: '04/10/2026',
  passage: 'Gênesis 4-6',
  title: TITLE,
  description: 'Uma descrição',
  link: 'https://open.spotify.com/episode/x',
  ...overrides
});

describe('DevotionalService.formatReadingMessage (message 1)', () => {
  test('opens with "Vamos ler a Bíblia hoje?" and brings the date, the passage and the shortened BibleGateway link', async () => {
    const shortener = new FakeShortener();
    const text = await new DevotionalService(readings, shortener).formatReadingMessage(devotional());
    expect({ text, requested: shortener.requested }).toEqual({
      text: `Vamos ler a Bíblia hoje?\n\n📖 Leitura de hoje - 04/10/2026\n\nGênesis 4-6\n\n🔗 Leia: ${SHORT}`,
      requested: ['https://www.biblegateway.com/passage/?search=genesis%204-6&version=NVI-PT&interface=print']
    });
  });
});

describe('DevotionalService.formatDevotionalMessage (message 2)', () => {
  test('brings the title in bold, the description and the episode link', () => {
    expect(service.formatDevotionalMessage(devotional())).toBe(
      `🎧 *${TITLE}*\n\nUma descrição\n\n▶️ Ouça no Spotify: https://open.spotify.com/episode/x`
    );
  });

  test('is null when the reading has no title, even with description and link', () => {
    expect(service.formatDevotionalMessage(devotional({ title: '' }))).toBeNull();
  });

  test.each([
    { label: 'without description', overrides: { description: '' }, expected: `🎧 *${TITLE}*\n\n▶️ Ouça no Spotify: https://open.spotify.com/episode/x` },
    { label: 'without link', overrides: { link: '' }, expected: `🎧 *${TITLE}*\n\nUma descrição` },
    { label: 'with only the title', overrides: { description: '', link: '' }, expected: `🎧 *${TITLE}*` }
  ])('$label drops the missing lines without leaving blank ones', ({ overrides, expected }) => {
    expect(service.formatDevotionalMessage(devotional(overrides))).toBe(expected);
  });
});
