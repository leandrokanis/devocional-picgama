import { randomUUID } from 'crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'fs/promises';
import path from 'path';
import type { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';
import type { AudioConverter, VoiceNoteResult } from './audio-converter.js';

export type AudioUpload = {
  originalName: string;
  mimeType: string;
  data: Buffer;
};

export type AudioMetadata = {
  originalName: string;
  sizeBytes: number;
  durationSeconds: number | null;
  updatedAt: Date;
};

export type AudioUploadErrorReason = 'invalid_type' | 'too_large' | 'conversion_failed';

export class AudioUploadError extends Error {
  constructor(public readonly reason: AudioUploadErrorReason, message: string) {
    super(message);
    this.name = 'AudioUploadError';
  }
}

export class AudioConflictError extends Error {
  constructor(public readonly date: string) {
    super(`Audio already exists for ${date}`);
    this.name = 'AudioConflictError';
  }
}

const isMissingFile = (error: unknown) => (error as NodeJS.ErrnoException)?.code === 'ENOENT';

const moveIfExists = async (from: string, to: string): Promise<boolean> => {
  try {
    await rename(from, to);
    return true;
  } catch (error) {
    if (isMissingFile(error)) return false;
    throw error;
  }
};

const isMp3 = (upload: AudioUpload) =>
  upload.originalName.toLowerCase().endsWith('.mp3') || upload.mimeType.toLowerCase() === 'audio/mpeg';

export class AudioService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly converter: AudioConverter,
    private readonly audioDir: string,
    private readonly maxBytes: number
  ) {}

  public async save(date: string, upload: AudioUpload): Promise<AudioMetadata> {
    if (!isMp3(upload)) throw new AudioUploadError('invalid_type', 'Only mp3 files are accepted');
    if (upload.data.length > this.maxBytes) {
      throw new AudioUploadError('too_large', `Audio file exceeds the ${this.maxBytes} bytes limit`);
    }
    await mkdir(this.audioDir, { recursive: true });
    const tempId = randomUUID();
    const tempInput = path.join(this.audioDir, `.${date}.${tempId}.upload.mp3`);
    const tempOutput = path.join(this.audioDir, `.${date}.${tempId}.ogg.tmp`);
    const backupPath = path.join(this.audioDir, `.${date}.${tempId}.previous.ogg`);
    const filePath = this.filePathFor(date);
    try {
      await writeFile(tempInput, upload.data);
      const { durationSeconds } = await this.convert(tempInput, tempOutput);
      const hadPrevious = await moveIfExists(filePath, backupPath);
      await rename(tempOutput, filePath);
      try {
        const data = { filePath, originalName: upload.originalName, sizeBytes: upload.data.length, durationSeconds };
        const record = await this.prisma.devotionalAudio.upsert({
          where: { date },
          create: { date, ...data },
          update: data
        });
        return this.toMetadata(record);
      } catch (error) {
        if (hadPrevious) await rename(backupPath, filePath);
        else await rm(filePath, { force: true });
        throw error;
      }
    } finally {
      await Promise.all([tempInput, tempOutput, backupPath].map((file) => rm(file, { force: true })));
    }
  }

  public async get(date: string): Promise<AudioMetadata | null> {
    const record = await this.findRecord(date);
    return record ? this.toMetadata(record) : null;
  }

  public async list(): Promise<Record<string, AudioMetadata>> {
    const records = await this.prisma.devotionalAudio.findMany();
    return Object.fromEntries(records.map((record) => [record.date, this.toMetadata(record)]));
  }

  public async remove(date: string): Promise<boolean> {
    const record = await this.findRecord(date);
    if (!record) return false;
    await this.prisma.devotionalAudio.delete({ where: { date } });
    await rm(record.filePath, { force: true });
    return true;
  }

  public async move(from: string, to: string): Promise<boolean> {
    const record = await this.findRecord(from);
    if (!record) return false;
    if (await this.findRecord(to)) throw new AudioConflictError(to);
    const filePath = this.filePathFor(to);
    await rename(record.filePath, filePath);
    try {
      await this.prisma.devotionalAudio.update({ where: { date: from }, data: { date: to, filePath } });
    } catch (error) {
      await rename(filePath, record.filePath);
      throw error;
    }
    return true;
  }

  public async readFile(date: string): Promise<Buffer | null> {
    const record = await this.findRecord(date);
    if (!record) return null;
    try {
      return await readFile(record.filePath);
    } catch (error) {
      if (!isMissingFile(error)) throw error;
      logger.warn(`Audio for ${date} is registered but its file is missing: ${record.filePath}`);
      return null;
    }
  }

  private findRecord(date: string) {
    return this.prisma.devotionalAudio.findUnique({ where: { date } });
  }

  private async convert(inputPath: string, outputPath: string): Promise<VoiceNoteResult> {
    try {
      return await this.converter.toVoiceNote(inputPath, outputPath);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new AudioUploadError('conversion_failed', `Could not convert the mp3 file: ${detail}`);
    }
  }

  private filePathFor(date: string): string {
    return path.join(this.audioDir, `${date}.ogg`);
  }

  private toMetadata(record: AudioMetadata): AudioMetadata {
    return {
      originalName: record.originalName,
      sizeBytes: record.sizeBytes,
      durationSeconds: record.durationSeconds,
      updatedAt: record.updatedAt
    };
  }
}
