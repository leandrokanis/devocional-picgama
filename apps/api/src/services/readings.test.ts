import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { readdirSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import type { AudioConverter, VoiceNoteResult } from './audio-converter.js';
import { AudioService } from './audio.js';
import { ReadingsService } from './readings.js';
import { createTestDatabase, type TestDatabase } from './test-db.js';

const mp3 = (content: string, originalName = 'devocional.mp3') => ({
  originalName,
  mimeType: 'audio/mpeg',
  data: Buffer.from(content)
});

const TITLE = '04/10: Quando uma criança fica no meio da roda (Mateus 16-18)';

class FakeConverter implements AudioConverter {
  async toVoiceNote(inputPath: string, outputPath: string): Promise<VoiceNoteResult> {
    const input = await readFile(inputPath);
    await writeFile(outputPath, Buffer.concat([Buffer.from('ogg:'), input]));
    return { durationSeconds: null };
  }
}

let db: TestDatabase;
let audioDir: string;
let audioService: AudioService;
let service: ReadingsService;

beforeEach(() => {
  db = createTestDatabase();
  audioDir = path.join(db.dir, 'audio');
  audioService = new AudioService(db.prisma, new FakeConverter(), audioDir, 1024);
  service = new ReadingsService(db.prisma, audioService);
});

afterEach(async () => {
  await db.cleanup();
});

describe('ScheduledReading schema', () => {
  test('migrations create the scheduled_readings table, with description and link defaulting to empty', async () => {
    await db.prisma.scheduledReading.create({ data: { date: '2026-10-04', title: 'Título', passage: 'Mateus 16-18' } });
    const stored = await db.prisma.scheduledReading.findUnique({ where: { date: '2026-10-04' } });
    expect(stored).toMatchObject({ date: '2026-10-04', title: 'Título', passage: 'Mateus 16-18', description: '', link: '' });
  });
});

describe('ReadingsService.create', () => {
  test('stores the reading for its date, keeping the title exactly as typed', async () => {
    await service.create({
      date: '2026-10-04',
      passage: 'Mateus 16-18',
      title: TITLE,
      description: 'Uma descrição',
      link: 'https://open.spotify.com/episode/x'
    });
    expect(await service.get('2026-10-04')).toEqual({
      date: '2026-10-04',
      passage: 'Mateus 16-18',
      title: TITLE,
      description: 'Uma descrição',
      link: 'https://open.spotify.com/episode/x',
      audio: null,
      status: 'pending',
      updatedAt: expect.any(Date)
    });
  });

  test.each([
    { label: 'a malformed date', input: { date: '2026-1-4', passage: 'Mateus 16-18' } },
    { label: 'a date that does not exist', input: { date: '2026-02-30', passage: 'Mateus 16-18' } },
    { label: 'an empty passage', input: { date: '2026-10-04', passage: '' } },
    { label: 'a blank passage', input: { date: '2026-10-04', passage: '   ' } }
  ])('rejects $label as invalid and stores nothing', async ({ input }) => {
    await expect(service.create(input)).rejects.toMatchObject({ name: 'ReadingError', reason: 'invalid' });
    expect(await db.prisma.scheduledReading.count()).toBe(0);
  });

  test('rejects a second reading on the same date as a conflict and keeps the existing one', async () => {
    await service.create({ date: '2026-10-04', passage: 'Mateus 16-18', title: TITLE });
    await expect(service.create({ date: '2026-10-04', passage: 'Outra', title: 'Outro' })).rejects.toMatchObject({
      name: 'ReadingError',
      reason: 'conflict'
    });
    expect(await service.get('2026-10-04')).toMatchObject({ passage: 'Mateus 16-18', title: TITLE });
  });

  test('optional title, description and link are stored as empty strings', async () => {
    await service.create({ date: '2026-10-04', passage: 'Mateus 16-18' });
    expect(await service.get('2026-10-04')).toMatchObject({ title: '', description: '', link: '' });
  });
});

describe('ReadingsService.get', () => {
  test('returns null for a date without a reading', async () => {
    expect(await service.get('2026-10-04')).toBeNull();
  });
});

describe('ReadingsService.list', () => {
  test('returns every reading ordered by date, whatever the insertion order', async () => {
    for (const date of ['2026-10-06', '2026-10-04', '2026-10-05']) await service.create({ date, passage: `P ${date}` });
    expect((await service.list()).map((reading) => reading.date)).toEqual(['2026-10-04', '2026-10-05', '2026-10-06']);
  });
});

describe('ReadingsService.list with a date range', () => {
  const dates = ['2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06'];
  const listDates = async (range: { from?: string; to?: string }) =>
    (await service.list(range)).map((reading) => reading.date);

  beforeEach(async () => {
    for (const date of dates) await service.create({ date, passage: `P ${date}` });
  });

  test('from keeps that date and the ones after it', async () => {
    expect(await listDates({ from: '2026-10-04' })).toEqual(['2026-10-04', '2026-10-05', '2026-10-06']);
  });

  test('to keeps that date and the ones before it', async () => {
    expect(await listDates({ to: '2026-10-04' })).toEqual(['2026-10-03', '2026-10-04']);
  });

  test('from and to together keep only the dates in between, inclusive', async () => {
    expect(await listDates({ from: '2026-10-04', to: '2026-10-05' })).toEqual(['2026-10-04', '2026-10-05']);
  });

  test('the same from and to return only the reading of that date', async () => {
    expect(await listDates({ from: '2026-10-05', to: '2026-10-05' })).toEqual(['2026-10-05']);
  });
});

describe('ReadingsService audio attachment', () => {
  test('each listed reading carries the audio of its date, or null when there is none', async () => {
    for (const date of ['2026-10-04', '2026-10-05']) await service.create({ date, passage: `P ${date}` });
    await audioService.save('2026-10-05', mp3('first'));
    expect((await service.list()).map(({ date, audio }) => ({ date, audio }))).toEqual([
      { date: '2026-10-04', audio: null },
      { date: '2026-10-05', audio: { originalName: 'devocional.mp3', sizeBytes: 5, durationSeconds: null, updatedAt: expect.any(Date) } }
    ]);
  });
});

describe('ReadingsService status', () => {
  const cases = [
    { label: 'title and audio', title: TITLE, withAudio: true, status: 'ready' },
    { label: 'title without audio', title: TITLE, withAudio: false, status: 'pending' },
    { label: 'audio without title', title: '', withAudio: true, status: 'pending' },
    { label: 'neither title nor audio', title: '', withAudio: false, status: 'pending' },
    { label: 'audio and a title of only spaces', title: '   ', withAudio: true, status: 'pending' }
  ];

  const prepare = async ({ title, withAudio }: { title: string; withAudio: boolean }) => {
    await service.create({ date: '2026-10-04', passage: 'Mateus 16-18', title });
    if (withAudio) await audioService.save('2026-10-04', mp3('first'));
  };

  test.each(cases)('get: a reading with $label is $status', async (scenario) => {
    await prepare(scenario);
    expect((await service.get('2026-10-04'))?.status).toBe(scenario.status);
  });

  test.each(cases)('list: a reading with $label is $status', async (scenario) => {
    await prepare(scenario);
    expect((await service.list()).map((reading) => reading.status)).toEqual([scenario.status]);
  });
});

describe('ReadingsService last change', () => {
  test('each reading carries when it was last saved, and an edit moves it forward', async () => {
    const created = await service.create({ date: '2026-10-04', passage: 'Mateus 16-18' });
    expect(created.updatedAt).toBeInstanceOf(Date);
    await new Promise((resolve) => setTimeout(resolve, 5));
    const edited = await service.update('2026-10-04', { passage: 'Mateus 16-18', title: TITLE });
    expect(edited.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime());
    expect((await service.get('2026-10-04'))?.updatedAt).toEqual(edited.updatedAt);
    expect((await service.list())[0]?.updatedAt).toEqual(edited.updatedAt);
  });
});

describe('ReadingsService.update', () => {
  test('rejects editing a date without a reading as not_found', async () => {
    await expect(service.update('2026-10-04', { passage: 'Mateus 16-18' })).rejects.toMatchObject({
      name: 'ReadingError',
      reason: 'not_found'
    });
  });

  test('an edit of every field is what the next get returns', async () => {
    await service.create({ date: '2026-10-04', passage: 'Mateus 16-18', title: 'Antigo', description: 'd', link: 'l' });
    await service.update('2026-10-04', {
      passage: 'Mateus 17',
      title: TITLE,
      description: 'Nova descrição',
      link: 'https://open.spotify.com/episode/y'
    });
    expect(await service.get('2026-10-04')).toMatchObject({
      passage: 'Mateus 17',
      title: TITLE,
      description: 'Nova descrição',
      link: 'https://open.spotify.com/episode/y'
    });
  });

  test('clearing title, description and link to empty strings is accepted', async () => {
    await service.create({ date: '2026-10-04', passage: 'Mateus 16-18', title: TITLE, description: 'd', link: 'l' });
    await service.update('2026-10-04', { passage: 'Mateus 16-18', title: '', description: '', link: '' });
    expect(await service.get('2026-10-04')).toMatchObject({ title: '', description: '', link: '' });
  });

  test.each([
    { label: 'a blank passage', input: { passage: '  ' } },
    { label: 'a new date that does not exist', input: { date: '2026-02-30', passage: 'Mateus 17' } }
  ])('rejects $label as invalid and keeps the reading unchanged', async ({ input }) => {
    await service.create({ date: '2026-10-04', passage: 'Mateus 16-18', title: TITLE });
    await expect(service.update('2026-10-04', input)).rejects.toMatchObject({ name: 'ReadingError', reason: 'invalid' });
    expect(await service.list()).toMatchObject([{ date: '2026-10-04', passage: 'Mateus 16-18', title: TITLE }]);
  });

  test('changing the date to a free one moves the reading: the old date is gone and the new one exists', async () => {
    await service.create({ date: '2026-10-04', passage: 'Mateus 16-18', title: TITLE });
    await service.update('2026-10-04', { date: '2026-10-07', passage: 'Mateus 16-18', title: TITLE });
    expect({ old: await service.get('2026-10-04'), moved: await service.get('2026-10-07') }).toMatchObject({
      old: null,
      moved: { date: '2026-10-07', passage: 'Mateus 16-18', title: TITLE }
    });
  });

  test('changing the date to one that already has a reading is a conflict and nothing changes', async () => {
    await service.create({ date: '2026-10-04', passage: 'Mateus 16-18', title: TITLE });
    await service.create({ date: '2026-10-05', passage: 'Mateus 19', title: 'Outro' });
    await expect(
      service.update('2026-10-04', { date: '2026-10-05', passage: 'Editada', title: 'Editado' })
    ).rejects.toMatchObject({ name: 'ReadingError', reason: 'conflict' });
    expect(await service.list()).toMatchObject([
      { date: '2026-10-04', passage: 'Mateus 16-18', title: TITLE },
      { date: '2026-10-05', passage: 'Mateus 19', title: 'Outro' }
    ]);
  });
});

describe('ReadingsService.update changing the date of a reading with audio', () => {
  test('the audio follows the reading: it shows on the new date and is gone from the old one, file included', async () => {
    await service.create({ date: '2026-10-04', passage: 'Mateus 16-18', title: TITLE });
    await audioService.save('2026-10-04', mp3('first'));
    await service.update('2026-10-04', { date: '2026-10-07', passage: 'Mateus 16-18', title: TITLE });
    expect({
      moved: (await service.get('2026-10-07'))?.audio,
      oldAudio: await audioService.get('2026-10-04'),
      dir: readdirSync(audioDir)
    }).toEqual({
      moved: { originalName: 'devocional.mp3', sizeBytes: 5, durationSeconds: null, updatedAt: expect.any(Date) },
      oldAudio: null,
      dir: ['2026-10-07.ogg']
    });
  });

  test('an orphan audio on the new date is a conflict and nothing changes: reading and both audios stay put', async () => {
    await service.create({ date: '2026-10-04', passage: 'Mateus 16-18', title: TITLE });
    await audioService.save('2026-10-04', mp3('first'));
    await audioService.save('2026-10-07', mp3('orphan', 'orfao.mp3'));
    await expect(
      service.update('2026-10-04', { date: '2026-10-07', passage: 'Editada', title: 'Editado' })
    ).rejects.toMatchObject({ name: 'ReadingError', reason: 'conflict' });
    expect({
      readings: await service.list(),
      from: (await audioService.readFile('2026-10-04'))?.toString(),
      to: (await audioService.readFile('2026-10-07'))?.toString()
    }).toMatchObject({
      readings: [{ date: '2026-10-04', passage: 'Mateus 16-18', title: TITLE, audio: { originalName: 'devocional.mp3' } }],
      from: 'ogg:first',
      to: 'ogg:orphan'
    });
  });

  test('when the reading write fails after the audio moved, the audio goes back to the old date', async () => {
    await service.create({ date: '2026-10-04', passage: 'Mateus 16-18', title: TITLE });
    await audioService.save('2026-10-04', mp3('first'));
    await db.prisma.$executeRawUnsafe(
      "CREATE TRIGGER fail_reading BEFORE UPDATE ON scheduled_readings BEGIN SELECT RAISE(ABORT, 'db down'); END;"
    );
    await expect(service.update('2026-10-04', { date: '2026-10-07', passage: 'Mateus 16-18' })).rejects.toThrow();
    expect({
      reading: await service.get('2026-10-04'),
      moved: await audioService.get('2026-10-07'),
      dir: readdirSync(audioDir)
    }).toMatchObject({
      reading: { date: '2026-10-04', title: TITLE, audio: { originalName: 'devocional.mp3' } },
      moved: null,
      dir: ['2026-10-04.ogg']
    });
  });
});

describe('ReadingsService.update changing the date of a reading without audio', () => {
  test('an orphan audio already on the new date starts to belong to the reading', async () => {
    await service.create({ date: '2026-10-04', passage: 'Mateus 16-18', title: TITLE });
    await audioService.save('2026-10-07', mp3('orphan', 'orfao.mp3'));
    await service.update('2026-10-04', { date: '2026-10-07', passage: 'Mateus 16-18', title: TITLE });
    expect((await service.get('2026-10-07'))?.audio).toMatchObject({ originalName: 'orfao.mp3' });
  });
});

describe('ReadingsService.remove', () => {
  test('deleting a reading with audio removes the reading, the audio record and the .ogg file', async () => {
    await service.create({ date: '2026-10-04', passage: 'Mateus 16-18', title: TITLE });
    await audioService.save('2026-10-04', mp3('first'));
    await service.remove('2026-10-04');
    expect({
      reading: await service.get('2026-10-04'),
      audio: await audioService.get('2026-10-04'),
      dir: readdirSync(audioDir)
    }).toEqual({ reading: null, audio: null, dir: [] });
  });

  test('rejects deleting a date without a reading as not_found', async () => {
    await expect(service.remove('2026-10-04')).rejects.toMatchObject({ name: 'ReadingError', reason: 'not_found' });
  });

  test('deleting a reading without audio removes only the reading', async () => {
    await service.create({ date: '2026-10-04', passage: 'Mateus 16-18' });
    await service.create({ date: '2026-10-05', passage: 'Mateus 19' });
    await service.remove('2026-10-04');
    expect((await service.list()).map((reading) => reading.date)).toEqual(['2026-10-05']);
  });
});

describe('ReadingsService.import', () => {
  test('old-format items {date, reading} become readings with passage = reading and empty title, description and link', async () => {
    const result = await service.import([
      { date: '2026-10-05', reading: 'Mateus 19-20' },
      { date: '2026-10-04', reading: 'Mateus 16-18' }
    ]);
    expect({ result, readings: await service.list() }).toMatchObject({
      result: { imported: 2, skipped: 0 },
      readings: [
        { date: '2026-10-04', passage: 'Mateus 16-18', title: '', description: '', link: '', audio: null, status: 'pending' },
        { date: '2026-10-05', passage: 'Mateus 19-20', title: '', description: '', link: '', audio: null, status: 'pending' }
      ]
    });
  });

  test('new and old formats mix in one file, and invalid items are skipped while the valid ones go in', async () => {
    const result = await service.import([
      { date: '2026-10-04', passage: 'Mateus 16-18', title: TITLE, description: 'd', link: 'l' },
      { date: '2026-10-05', reading: 'Mateus 19-20' },
      { date: '2026-02-30', passage: 'Data inexistente' },
      { date: '2026-10-06', passage: '   ' },
      'not an object'
    ]);
    expect({ result, readings: await service.list() }).toMatchObject({
      result: { imported: 2, skipped: 3 },
      readings: [
        { date: '2026-10-04', passage: 'Mateus 16-18', title: TITLE, description: 'd', link: 'l' },
        { date: '2026-10-05', passage: 'Mateus 19-20', title: '' }
      ]
    });
  });

  test('dates that already exist are skipped and the existing reading does not change', async () => {
    await service.create({ date: '2026-10-04', passage: 'Mateus 16-18', title: TITLE });
    const result = await service.import([
      { date: '2026-10-04', passage: 'Sobrescrita', title: 'Outro' },
      { date: '2026-10-05', reading: 'Mateus 19-20' }
    ]);
    expect({ result, readings: await service.list() }).toMatchObject({
      result: { imported: 1, skipped: 1 },
      readings: [{ date: '2026-10-04', passage: 'Mateus 16-18', title: TITLE }, { date: '2026-10-05' }]
    });
  });

  test('a date repeated in the file keeps the first occurrence and counts the others as skipped', async () => {
    const result = await service.import([
      { date: '2026-10-04', passage: 'Primeira' },
      { date: '2026-10-04', passage: 'Segunda' },
      { date: '2026-10-04', reading: 'Terceira' }
    ]);
    expect({ result, readings: await service.list() }).toMatchObject({
      result: { imported: 1, skipped: 2 },
      readings: [{ date: '2026-10-04', passage: 'Primeira' }]
    });
  });

  test.each([
    { label: 'an object', body: { date: '2026-10-04', passage: 'Mateus 16-18' } },
    { label: 'a string', body: 'not json' },
    { label: 'null', body: null }
  ])('rejects $label instead of a list as invalid and creates nothing', async ({ body }) => {
    await expect(service.import(body)).rejects.toMatchObject({ name: 'ReadingError', reason: 'invalid' });
    expect(await service.list()).toEqual([]);
  });

  test('importing the same file twice imports nothing the second time and skips every item', async () => {
    const file = [
      { date: '2026-10-04', reading: 'Mateus 16-18' },
      { date: '2026-10-05', reading: 'Mateus 19-20' }
    ];
    await service.import(file);
    expect(await service.import(file)).toEqual({ imported: 0, skipped: 2 });
  });
});
