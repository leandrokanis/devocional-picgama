import { test, expect } from 'bun:test';
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
    expect(formatted).toContain('https://bit.ly/devocional-restauracao');
    expect(formatted).not.toContain('AT1:');
  } finally {
    unlinkSync(filePath);
  }
});
