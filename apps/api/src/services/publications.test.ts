import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { PublicationsService } from './publications.js';
import { createTestDatabase, type TestDatabase } from './test-db.js';

let db: TestDatabase;
let service: PublicationsService;

beforeEach(() => {
  db = createTestDatabase();
  service = new PublicationsService(db.prisma);
});

afterEach(async () => {
  await db.cleanup();
});

const seed = (readingDate: string, chatId: string, publishedAt: string) =>
  db.prisma.readingPublication.create({
    data: { readingDate, chatId, groupName: `Grupo ${chatId}`, publishedAt: new Date(publishedAt) }
  });

describe('PublicationsService.record', () => {
  test('each delivery to a group becomes one publication of that date, repeats included', async () => {
    await service.record('2099-01-01', { chatId: 'a@g.us', groupName: 'Grupo A' });
    await service.record('2099-01-01', { chatId: 'a@g.us', groupName: 'Grupo A' });
    expect(await service.listFor('2099-01-01')).toEqual([
      { chatId: 'a@g.us', groupName: 'Grupo A', publishedAt: expect.any(Date) },
      { chatId: 'a@g.us', groupName: 'Grupo A', publishedAt: expect.any(Date) }
    ]);
  });
});

describe('PublicationsService.listFor', () => {
  test('returns only the publications of that date, the most recent first', async () => {
    await seed('2099-01-01', 'a@g.us', '2099-01-01T09:00:00.000Z');
    await seed('2099-01-01', 'b@g.us', '2099-01-01T11:00:00.000Z');
    await seed('2099-01-02', 'c@g.us', '2099-01-02T12:00:00.000Z');
    await seed('2099-01-01', 'c@g.us', '2099-01-01T10:00:00.000Z');
    expect(await service.listFor('2099-01-01')).toEqual([
      { chatId: 'b@g.us', groupName: 'Grupo b@g.us', publishedAt: new Date('2099-01-01T11:00:00.000Z') },
      { chatId: 'c@g.us', groupName: 'Grupo c@g.us', publishedAt: new Date('2099-01-01T10:00:00.000Z') },
      { chatId: 'a@g.us', groupName: 'Grupo a@g.us', publishedAt: new Date('2099-01-01T09:00:00.000Z') }
    ]);
  });

  test('publications at the same instant come latest-recorded first', async () => {
    await seed('2099-01-01', 'a@g.us', '2099-01-01T09:00:00.000Z');
    await seed('2099-01-01', 'b@g.us', '2099-01-01T09:00:00.000Z');
    expect((await service.listFor('2099-01-01')).map((publication) => publication.chatId)).toEqual(['b@g.us', 'a@g.us']);
  });
});

describe('PublicationsService.summaries', () => {
  beforeEach(async () => {
    await seed('2099-01-01', 'a@g.us', '2099-01-01T11:00:00.000Z');
    await seed('2099-01-01', 'b@g.us', '2099-01-01T09:00:00.000Z');
    await seed('2099-01-01', 'c@g.us', '2099-01-01T10:00:00.000Z');
    await seed('2099-01-02', 'a@g.us', '2099-01-02T08:00:00.000Z');
  });

  test('gives each published date its first publication, and dates without one are absent', async () => {
    expect(await service.summaries()).toEqual({
      '2099-01-01': new Date('2099-01-01T09:00:00.000Z'),
      '2099-01-02': new Date('2099-01-02T08:00:00.000Z')
    });
  });

  test('with a list of dates, summarizes only those dates', async () => {
    expect(await service.summaries(['2099-01-02', '2099-01-03'])).toEqual({
      '2099-01-02': new Date('2099-01-02T08:00:00.000Z')
    });
  });
});

describe('PublicationsService.moveDate and removeFor', () => {
  beforeEach(async () => {
    await seed('2099-01-01', 'a@g.us', '2099-01-01T09:00:00.000Z');
    await seed('2099-01-01', 'b@g.us', '2099-01-01T10:00:00.000Z');
    await seed('2099-01-02', 'c@g.us', '2099-01-02T08:00:00.000Z');
  });

  test('moveDate takes every publication of a date to the new date, inside the given transaction', async () => {
    await db.prisma.$transaction((tx) => service.moveDate('2099-01-01', '2099-01-05', tx));
    expect({
      old: await service.listFor('2099-01-01'),
      moved: (await service.listFor('2099-01-05')).map((publication) => publication.chatId),
      other: (await service.listFor('2099-01-02')).map((publication) => publication.chatId)
    }).toEqual({ old: [], moved: ['b@g.us', 'a@g.us'], other: ['c@g.us'] });
  });

  test('removeFor deletes every publication of that date and only of it, inside the given transaction', async () => {
    await db.prisma.$transaction((tx) => service.removeFor('2099-01-01', tx));
    expect(await service.summaries()).toEqual({ '2099-01-02': new Date('2099-01-02T08:00:00.000Z') });
  });
});
