import { test, expect } from 'vitest';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { DevotionalService } from './devotional.js';

const createTempJsonFile = (data: unknown) => {
  const filePath = join(tmpdir(), `devocional-readings-${crypto.randomUUID()}.json`);
  writeFileSync(filePath, JSON.stringify(data), 'utf-8');
  return filePath;
};

test('loads simple readings format (date + reading)', async () => {
  const filePath = createTempJsonFile([
    { date: '2026-01-02', reading: 'Gênesis 4-6' }
  ]);

  try {
    const service = new DevotionalService(filePath);
    expect(service.validateReadings()).toBe(true);

    const date = new Date(Date.UTC(2026, 0, 2, 12, 0, 0));
    const message = service.getReadingForDate(date);
    expect(message).not.toBeNull();
    expect(message!.reading).toBe('Gênesis 4-6');

    const formatted = await service.formatMessage(message!);
    expect(formatted).toContain('Gênesis 4-6');
    expect(formatted).toContain('https://www.biblegateway.com/passage/');
    expect(formatted).toContain('genesis%204-6');
    expect(formatted).toContain('version=NVI-PT');
  } finally {
    unlinkSync(filePath);
  }
});

const readingsFile = () => createTempJsonFile([{ date: '2026-01-02', reading: 'Gênesis 4-6' }]);
const devotional = { date: '2026-01-02', formattedDate: '02/01/2026', reading: 'Gênesis 4-6' };
const textWithoutAudioLine =
  '📖 Leitura de hoje - 02/01/2026\n\nGênesis 4-6\n\n🔗 Leia: https://www.biblegateway.com/passage/?search=genesis%204-6&version=NVI-PT&interface=print';

test.each([
  { label: 'no options', options: undefined },
  { label: 'hasAudio false', options: { hasAudio: false } }
])('formatMessage with $label keeps today\'s exact text, with the 🎧 line', async ({ options }) => {
  const filePath = readingsFile();
  try {
    const service = new DevotionalService(filePath);
    expect(await service.formatMessage(devotional, options)).toBe(
      `${textWithoutAudioLine}\n\n🎧 Devocional em áudio: https://is.gd/rjLzat`
    );
  } finally {
    unlinkSync(filePath);
  }
});

test('formatMessage with hasAudio omits the 🎧 line', async () => {
  const filePath = readingsFile();
  try {
    const service = new DevotionalService(filePath);
    expect(await service.formatMessage(devotional, { hasAudio: true })).toBe(textWithoutAudioLine);
  } finally {
    unlinkSync(filePath);
  }
});
