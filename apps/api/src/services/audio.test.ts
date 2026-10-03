import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { readdirSync, readFileSync, unlinkSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import type { AudioConverter } from './audio-converter.js';
import { AudioService, type AudioUpload } from './audio.js';
import { createTestDatabase, type TestDatabase } from './test-db.js';
import { logger } from '../utils/logger.js';

const DATE = '2026-01-02';
const MAX_BYTES = 1024;

class FakeConverter implements AudioConverter {
  public failWith: Error | null = null;

  async toVoiceNote(inputPath: string, outputPath: string): Promise<void> {
    if (this.failWith) throw this.failWith;
    const input = await readFile(inputPath);
    await writeFile(outputPath, Buffer.concat([Buffer.from('ogg:'), input]));
  }
}

const mp3 = (content: string, originalName = 'devocional.mp3'): AudioUpload => ({
  originalName,
  mimeType: 'audio/mpeg',
  data: Buffer.from(content)
});

let db: TestDatabase;
let audioDir: string;
let converter: FakeConverter;
let service: AudioService;

const storedFile = () => readFileSync(path.join(audioDir, `${DATE}.ogg`), 'utf-8');

beforeEach(async () => {
  db = createTestDatabase();
  audioDir = path.join(db.dir, 'audio');
  converter = new FakeConverter();
  service = new AudioService(db.prisma, converter, audioDir, MAX_BYTES);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await db.cleanup();
});

describe('DevotionalAudio schema', () => {
  test('migrations create the devotional_audios table used by the client', async () => {
    await db.prisma.devotionalAudio.create({
      data: { date: '2026-01-02', filePath: '/tmp/2026-01-02.ogg', originalName: 'a.mp3', sizeBytes: 10 }
    });
    const stored = await db.prisma.devotionalAudio.findUnique({ where: { date: '2026-01-02' } });
    expect(stored).toMatchObject({ date: '2026-01-02', originalName: 'a.mp3', sizeBytes: 10 });
  });
});

describe('AudioService.save', () => {
  test('attaching stores the converted voice note as <date>.ogg and records its metadata', async () => {
    await service.save(DATE, mp3('first'));
    expect(storedFile()).toBe('ogg:first');
    expect(await service.get(DATE)).toMatchObject({ originalName: 'devocional.mp3', sizeBytes: 5 });
  });

  test('replacing swaps the file and the metadata, leaving only <date>.ogg in AUDIO_DIR', async () => {
    await service.save(DATE, mp3('first'));
    await service.save(DATE, mp3('second!', 'novo.mp3'));
    expect({ file: storedFile(), dir: readdirSync(audioDir), meta: await service.get(DATE) }).toMatchObject({
      file: 'ogg:second!',
      dir: [`${DATE}.ogg`],
      meta: { originalName: 'novo.mp3', sizeBytes: 7 }
    });
  });

  test('rejects a file that is neither .mp3 nor audio/mpeg and keeps the previous audio', async () => {
    await service.save(DATE, mp3('first'));
    const upload = { originalName: 'notes.txt', mimeType: 'text/plain', data: Buffer.from('text') };
    await expect(service.save(DATE, upload)).rejects.toMatchObject({ reason: 'invalid_type' });
    expect({ file: storedFile(), meta: await service.get(DATE) }).toMatchObject({
      file: 'ogg:first',
      meta: { originalName: 'devocional.mp3' }
    });
  });

  test.each([
    { originalName: 'devocional.mp3', mimeType: 'application/octet-stream' },
    { originalName: 'devocional', mimeType: 'audio/mpeg' }
  ])('accepts an upload identified as mp3 by extension or by mime ($originalName, $mimeType)', async (file) => {
    await service.save(DATE, { ...file, data: Buffer.from('first') });
    expect(storedFile()).toBe('ogg:first');
  });

  test('rejects a file above the size limit and keeps the previous audio', async () => {
    await service.save(DATE, mp3('first'));
    await expect(service.save(DATE, mp3('x'.repeat(MAX_BYTES + 1)))).rejects.toMatchObject({ reason: 'too_large' });
    expect({ file: storedFile(), meta: await service.get(DATE) }).toMatchObject({
      file: 'ogg:first',
      meta: { originalName: 'devocional.mp3', sizeBytes: 5 }
    });
  });

  test('accepts a file exactly at the size limit', async () => {
    await service.save(DATE, mp3('x'.repeat(MAX_BYTES)));
    expect(await service.get(DATE)).toMatchObject({ sizeBytes: MAX_BYTES });
  });

  test('a failed conversion is rejected, keeps the previous audio and leaves no temporary files', async () => {
    await service.save(DATE, mp3('first'));
    converter.failWith = new Error('ffmpeg exited with code 1: Invalid data');
    await expect(service.save(DATE, mp3('broken', 'outro.mp3'))).rejects.toMatchObject({ reason: 'conversion_failed' });
    expect({ file: storedFile(), dir: readdirSync(audioDir), meta: await service.get(DATE) }).toMatchObject({
      file: 'ogg:first',
      dir: [`${DATE}.ogg`],
      meta: { originalName: 'devocional.mp3' }
    });
  });

  test('when the database write fails on a replacement, the previous file is restored', async () => {
    await service.save(DATE, mp3('first'));
    await db.prisma.$executeRawUnsafe(
      "CREATE TRIGGER fail_update BEFORE UPDATE ON devotional_audios BEGIN SELECT RAISE(ABORT, 'db down'); END;"
    );
    await expect(service.save(DATE, mp3('second', 'novo.mp3'))).rejects.toThrow();
    expect({ file: storedFile(), dir: readdirSync(audioDir) }).toEqual({ file: 'ogg:first', dir: [`${DATE}.ogg`] });
  });

  test('when the database write fails on a first attach, no file is left behind', async () => {
    await db.prisma.$executeRawUnsafe(
      "CREATE TRIGGER fail_insert BEFORE INSERT ON devotional_audios BEGIN SELECT RAISE(ABORT, 'db down'); END;"
    );
    await expect(service.save(DATE, mp3('first'))).rejects.toThrow();
    expect(readdirSync(audioDir)).toEqual([]);
  });
});

describe('AudioService.get', () => {
  test('returns null for a date without audio', async () => {
    expect(await service.get(DATE)).toBeNull();
  });
});

describe('AudioService.list', () => {
  test('maps each date with audio to its metadata', async () => {
    await service.save(DATE, mp3('first'));
    await service.save('2026-01-03', mp3('other', 'tres.mp3'));
    const list = await service.list();
    expect(list).toEqual({
      [DATE]: { originalName: 'devocional.mp3', sizeBytes: 5, updatedAt: expect.any(Date) },
      '2026-01-03': { originalName: 'tres.mp3', sizeBytes: 5, updatedAt: expect.any(Date) }
    });
  });
});

describe('AudioService.remove', () => {
  test('deletes the record and the file', async () => {
    await service.save(DATE, mp3('first'));
    const removed = await service.remove(DATE);
    expect({ removed, meta: await service.get(DATE), dir: readdirSync(audioDir) }).toEqual({
      removed: true,
      meta: null,
      dir: []
    });
  });

  test('returns false when the date has no audio', async () => {
    expect(await service.remove(DATE)).toBe(false);
  });

  test('still deletes the record when the file is already gone', async () => {
    await service.save(DATE, mp3('first'));
    unlinkSync(path.join(audioDir, `${DATE}.ogg`));
    const removed = await service.remove(DATE);
    expect({ removed, meta: await service.get(DATE) }).toEqual({ removed: true, meta: null });
  });
});

describe('AudioService.readFile', () => {
  test('returns the stored voice note bytes', async () => {
    await service.save(DATE, mp3('first'));
    expect((await service.readFile(DATE))?.toString()).toBe('ogg:first');
  });

  test('returns null for a date without audio', async () => {
    expect(await service.readFile(DATE)).toBeNull();
  });

  test('returns null and logs a warning when the record exists but the file is gone', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    await service.save(DATE, mp3('first'));
    unlinkSync(path.join(audioDir, `${DATE}.ogg`));
    const result = await service.readFile(DATE);
    expect({ result, warned: warn.mock.calls.some(([message]) => String(message).includes(DATE)) }).toEqual({
      result: null,
      warned: true
    });
  });
});

describe('AudioService.move', () => {
  const TO = '2026-01-05';

  test('moves the voice note to the new date: file renamed, record re-dated, nothing left on the old date', async () => {
    await service.save(DATE, mp3('first'));
    await service.move(DATE, TO);
    expect({
      dir: readdirSync(audioDir),
      old: await service.get(DATE),
      moved: await service.get(TO),
      bytes: (await service.readFile(TO))?.toString()
    }).toEqual({
      dir: [`${TO}.ogg`],
      old: null,
      moved: { originalName: 'devocional.mp3', sizeBytes: 5, updatedAt: expect.any(Date) },
      bytes: 'ogg:first'
    });
  });

  test('refuses to move onto a date that already has audio, leaving both voice notes untouched', async () => {
    await service.save(DATE, mp3('first'));
    await service.save(TO, mp3('orphan', 'orfao.mp3'));
    await expect(service.move(DATE, TO)).rejects.toMatchObject({ name: 'AudioConflictError' });
    expect({
      dir: readdirSync(audioDir).sort(),
      from: (await service.readFile(DATE))?.toString(),
      to: (await service.readFile(TO))?.toString(),
      toMeta: await service.get(TO)
    }).toMatchObject({
      dir: [`${DATE}.ogg`, `${TO}.ogg`],
      from: 'ogg:first',
      to: 'ogg:orphan',
      toMeta: { originalName: 'orfao.mp3' }
    });
  });

  test('when the database write fails, the file goes back to the old date and the record stays there', async () => {
    await service.save(DATE, mp3('first'));
    await db.prisma.$executeRawUnsafe(
      "CREATE TRIGGER fail_move BEFORE UPDATE ON devotional_audios BEGIN SELECT RAISE(ABORT, 'db down'); END;"
    );
    await expect(service.move(DATE, TO)).rejects.toThrow();
    expect({
      dir: readdirSync(audioDir),
      bytes: (await service.readFile(DATE))?.toString(),
      moved: await service.get(TO)
    }).toEqual({ dir: [`${DATE}.ogg`], bytes: 'ogg:first', moved: null });
  });

  test('returns false and does nothing when the old date has no audio', async () => {
    expect(await service.move(DATE, TO)).toBe(false);
  });
});
