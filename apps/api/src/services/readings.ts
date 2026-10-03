import type { PrismaClient, ScheduledReading } from '@prisma/client';
import type { AudioMetadata, AudioService } from './audio.js';

export type ReadingInput = {
  date: string;
  passage: string;
  title?: string;
  description?: string;
  link?: string;
};

export type ReadingUpdate = Omit<ReadingInput, 'date'> & { date?: string };

export type ImportResult = { imported: number; skipped: number };

export type Reading = {
  date: string;
  passage: string;
  title: string;
  description: string;
  link: string;
  audio: AudioMetadata | null;
};

export type ReadingErrorReason = 'invalid' | 'not_found' | 'conflict';

export class ReadingError extends Error {
  constructor(public readonly reason: ReadingErrorReason, message: string) {
    super(message);
    this.name = 'ReadingError';
  }
}

type ReadingFields = Omit<Reading, 'audio'>;

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

export class ReadingsService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly audioService: AudioService
  ) {}

  public async create(input: ReadingInput): Promise<Reading> {
    const data = validateReadingInput(input);
    await this.ensureFree(data.date);
    const record = await this.prisma.scheduledReading.create({ data });
    return this.toReading(record, await this.audioService.get(record.date));
  }

  public async get(date: string): Promise<Reading | null> {
    const record = await this.prisma.scheduledReading.findUnique({ where: { date } });
    if (!record) return null;
    return this.toReading(record, await this.audioService.get(date));
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
    const record = await this.prisma.scheduledReading.update({ where: { date }, data }).catch(async (error: unknown) => {
      if (audioMoved) await this.audioService.move(data.date, date);
      throw error;
    });
    return this.toReading(record, await this.audioService.get(record.date));
  }

  public async remove(date: string): Promise<void> {
    await this.ensureExists(date);
    await this.prisma.scheduledReading.delete({ where: { date } });
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

  public async list(dateFilter?: string): Promise<Reading[]> {
    const records = await this.prisma.scheduledReading.findMany({
      where: dateFilter ? { date: dateFilter } : undefined,
      orderBy: { date: 'asc' }
    });
    const audios = await this.audioService.list();
    return records.map((record) => this.toReading(record, audios[record.date] ?? null));
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

  private toReading(record: ScheduledReading, audio: AudioMetadata | null): Reading {
    return {
      date: record.date,
      passage: record.passage,
      title: record.title,
      description: record.description,
      link: record.link,
      audio
    };
  }
}
