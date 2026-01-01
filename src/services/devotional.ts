import { readFileSync } from 'fs';
import { join } from 'path';
import { getDateString, formatDate } from '../utils/date.js';
import { logger } from '../utils/logger.js';
import { UrlShortenerService } from './url-shortener.js';

export interface DevotionalReading {
  date: string;
  reading: string;
}

export interface DevotionalMessage {
  date: string;
  formattedDate: string;
  reading: string;
}

export class DevotionalService {
  private readings: DevotionalReading[] = [];
  private dataPath: string;
  private urlShortener: UrlShortenerService | null;

  constructor(dataPath?: string, urlShortener?: UrlShortenerService) {
    this.dataPath = dataPath || join(process.cwd(), 'data', 'readings-2026.json');
    this.urlShortener = urlShortener || null;
    this.loadReadings();
  }

  private normalizeReading(input: unknown): DevotionalReading | null {
    if (!input || typeof input !== 'object') return null;

    const candidate = input as Record<string, unknown>;
    const date = candidate.date;

    if (typeof date !== 'string' || date.trim() === '') return null;

    const reading = candidate.reading;
    if (typeof reading === 'string' && reading.trim() !== '') {
      return { date, reading };
    }

    return null;
  }

  private loadReadings(): void {
    try {
      const fileContent = readFileSync(this.dataPath, 'utf-8');
      const parsed: unknown = JSON.parse(fileContent);

      if (!Array.isArray(parsed)) {
        throw new Error('Readings data is not an array');
      }

      const normalized: DevotionalReading[] = [];
      for (const item of parsed) {
        const reading = this.normalizeReading(item);
        if (!reading) {
          throw new Error('Invalid reading format');
        }
        normalized.push(reading);
      }

      this.readings = normalized;
      logger.info(`Loaded ${this.readings.length} devotional readings`);
    } catch (error) {
      logger.error('Error loading devotional readings', error);
      throw new Error('Failed to load devotional readings from JSON file');
    }
  }

  public getReadingForDate(date: Date): DevotionalMessage | null {
    const dateString = getDateString(date);
    const reading = this.readings.find(r => r.date === dateString);
    
    if (!reading) {
      logger.warn(`No devotional reading found for date: ${dateString}`);
      return null;
    }

    return {
      date: reading.date,
      formattedDate: formatDate(date),
      reading: reading.reading
    };
  }

  public getTodaysReading(): DevotionalMessage | null {
    return this.getReadingForDate(new Date());
  }

  public getTodaysReadingBasic(): DevotionalReading | null {
    const dateString = getDateString(new Date());
    return this.readings.find(r => r.date === dateString) || null;
  }

  private formatReadingForUrl(reading: string): string {
    return reading
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '%20');
  }

  private generateBibleGatewayLink(reading: string): string {
    const searchParam = this.formatReadingForUrl(reading);
    return `https://www.biblegateway.com/passage/?search=${searchParam}&version=NVI-PT&interface=print`;
  }

  public async formatMessage(devotional: DevotionalMessage): Promise<string> {
    const originalLink = this.generateBibleGatewayLink(devotional.reading);
    const link = this.urlShortener 
      ? await this.urlShortener.shorten(originalLink)
      : originalLink;
    const audioLink = 'https://is.gd/rjLzat';
    return `📖 Leitura de hoje - ${devotional.formattedDate}\n\n${devotional.reading}\n\n🔗 Leia: ${link}\n\n🎧 Devocional em áudio: ${audioLink}`;
  }

  public validateReadings(): boolean {
    if (!Array.isArray(this.readings)) {
      logger.error('Readings data is not an array');
      return false;
    }

    for (const reading of this.readings) {
      if (!reading.date || !reading.reading) {
        logger.error('Invalid reading format', reading);
        return false;
      }
    }

    return true;
  }

  public getReadingsCount(): number {
    return this.readings.length;
  }

  public getAllReadings(dateFilter?: string): DevotionalReading[] {
    if (!dateFilter) {
      return [...this.readings];
    }
    
    return this.readings.filter(reading => reading.date === dateFilter);
  }
}
