import type { PrismaClient, ScheduledReading } from '@prisma/client';
import type { AudioMetadata, AudioService } from './audio.js';
import type { Publication, PublicationsService } from './publications.js';

export type ReadingInput = {
  date: string;
  passage: string;
  title?: string;
  description?: string;
  link?: string;
};

export type ReadingUpdate = Omit<ReadingInput, 'date'> & { date?: string };

export type ImportResult = { imported: number; skipped: number };

export type ReadingStatus = 'pending' | 'published';

export type Reading = {
  date: string;
  passage: string;
  title: string;
  description: string;
  link: string;
  audio: AudioMetadata | null;
  status: ReadingStatus;
  publishedAt: Date | null;
  updatedAt: Date;
};

export type ReadingWithPublications = Reading & { publications: Publication[] };

export type ReadingErrorReason = 'invalid' | 'not_found' | 'conflict';

export class ReadingError extends Error {
  constructor(public readonly reason: ReadingErrorReason, message: string) {
    super(message);
    this.name = 'ReadingError';
  }
}

type ReadingFields = Omit<Reading, 'audio' | 'status' | 'publishedAt' | 'updatedAt'>;

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const isRealDate = (value: string): boolean => {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number) as [number, number, number];
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
};

const optionalText = (value: unknown, field: string): string => {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw new ReadingError('invalid', `"${field}" must be a string`);
  return value;
};

export const validateReadingInput = (input: unknown): ReadingFields => {
  if (!input || typeof input !== 'object') throw new ReadingError('invalid', 'Reading must be an object');
  const candidate = input as Record<string, unknown>;
  if (typeof candidate.date !== 'string' || !isRealDate(candidate.date)) {
    throw new ReadingError('invalid', '"date" must be a valid YYYY-MM-DD date');
  }
  if (typeof candidate.passage !== 'string' || candidate.passage.trim() === '') {
    throw new ReadingError('invalid', '"passage" is required');
  }
  return {
    date: candidate.date,
    passage: candidate.passage,
    title: optionalText(candidate.title, 'title'),
    description: optionalText(candidate.description, 'description'),
    link: optionalText(candidate.link, 'link')
  };
};

const fromOldFormat = (input: unknown): unknown => {
  if (!input || typeof input !== 'object') return input;
  const candidate = input as Record<string, unknown>;
  if (candidate.passage !== undefined || candidate.reading === undefined) return input;
  return { date: candidate.date, passage: candidate.reading };
};

const tryValidate = (input: unknown): ReadingFields | null => {
  try {
    return validateReadingInput(input);
  } catch (error) {
    if (error instanceof ReadingError) return null;
    throw error;
  }
};

export type ReadingRange = { from?: string; to?: string };

export class ReadingsService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly audioService: AudioService,
    private readonly publications: PublicationsService
  ) {}

  public async create(input: ReadingInput): Promise<Reading> {
    const data = validateReadingInput(input);
    await this.ensureFree(data.date);
    const record = await this.prisma.scheduledReading.create({ data });
    return this.load(record);
  }

  public async get(date: string): Promise<ReadingWithPublications | null> {
    const record = await this.prisma.scheduledReading.findUnique({ where: { date } });
    if (!record) return null;
    return { ...(await this.load(record)), publications: await this.publications.listFor(date) };
  }

  public async update(date: string, input: ReadingUpdate): Promise<Reading> {
    await this.ensureExists(date);
    const data = validateReadingInput({ ...input, date: input.date ?? date });
    let audioMoved = false;
    if (data.date !== date) {
      await this.ensureFree(data.date);
      await this.ensureAudioCanFollow(date, data.date);
      audioMoved = await this.audioService.move(date, data.date);
    }
    const record = await this.prisma
      .$transaction(async (tx) => {
        if (data.date !== date) await this.publications.moveDate(date, data.date, tx);
        return tx.scheduledReading.update({ where: { date }, data });
      })
      .catch(async (error: unknown) => {
        if (audioMoved) await this.audioService.move(data.date, date);
        throw error;
      });
    return this.load(record);
  }

  public async remove(date: string): Promise<void> {
    await this.ensureExists(date);
    await this.prisma.$transaction(async (tx) => {
      await this.publications.removeFor(date, tx);
      await tx.scheduledReading.delete({ where: { date } });
    });
    await this.audioService.remove(date);
  }

  public async import(items: unknown): Promise<ImportResult> {
    if (!Array.isArray(items)) throw new ReadingError('invalid', 'Import must be a JSON array of readings');
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.scheduledReading.findMany({ select: { date: true } });
      const taken = new Set(existing.map((reading) => reading.date));
      const data: ReadingFields[] = [];
      for (const item of items) {
        const valid = tryValidate(fromOldFormat(item));
        if (!valid || taken.has(valid.date)) continue;
        taken.add(valid.date);
        data.push(valid);
      }
      await tx.scheduledReading.createMany({ data });
      return { imported: data.length, skipped: items.length - data.length };
    });
  }

  public async list(range: ReadingRange = {}): Promise<Reading[]> {
    const records = await this.prisma.scheduledReading.findMany({
      where: { date: { gte: range.from, lte: range.to } },
      orderBy: { date: 'asc' }
    });
    const audios = await this.audioService.list();
    const firstPublications = await this.publications.summaries(records.map((record) => record.date));
    return records.map((record) => this.toReading(record, audios[record.date] ?? null, firstPublications[record.date] ?? null));
  }

  private async ensureExists(date: string): Promise<void> {
    const existing = await this.prisma.scheduledReading.findUnique({ where: { date } });
    if (!existing) throw new ReadingError('not_found', `No reading found for ${date}`);
  }

  private async ensureFree(date: string): Promise<void> {
    const existing = await this.prisma.scheduledReading.findUnique({ where: { date } });
    if (existing) throw new ReadingError('conflict', `A reading already exists for ${date}`);
  }

  private async ensureAudioCanFollow(from: string, to: string): Promise<void> {
    if (!(await this.audioService.get(from))) return;
    if (await this.audioService.get(to)) {
      throw new ReadingError('conflict', `The reading has audio and ${to} already has another audio`);
    }
  }

  private async load(record: ScheduledReading): Promise<Reading> {
    const firstPublications = await this.publications.summaries([record.date]);
    return this.toReading(record, await this.audioService.get(record.date), firstPublications[record.date] ?? null);
  }

  private toReading(record: ScheduledReading, audio: AudioMetadata | null, publishedAt: Date | null): Reading {
    return {
      date: record.date,
      passage: record.passage,
      title: record.title,
      description: record.description,
      link: record.link,
      audio,
      status: publishedAt ? 'published' : 'pending',
      publishedAt,
      updatedAt: record.updatedAt
    };
  }
}
