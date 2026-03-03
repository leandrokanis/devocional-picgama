import { readFileSync } from 'fs';
import { join } from 'path';
import { formatDate, getDateString } from '../utils/date.js';
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
    const reading = candidate.reading;
    if (typeof date !== 'string' || date.trim() === '') return null;
    if (typeof reading !== 'string' || reading.trim() === '') return null;
    return { date, reading };
  }

  private loadReadings(): void {
    try {
      const fileContent = readFileSync(this.dataPath, 'utf-8');
      const parsed = JSON.parse(fileContent) as unknown;
      if (!Array.isArray(parsed)) throw new Error('Readings data is not an array');
      this.readings = parsed.map((item) => {
        const normalized = this.normalizeReading(item);
        if (!normalized) throw new Error('Invalid reading format');
        return normalized;
      });
      logger.info(`Loaded ${this.readings.length} devotional readings`);
    } catch (error) {
      logger.error('Error loading devotional readings', error);
      throw new Error('Failed to load devotional readings from JSON file');
    }
  }

  public getTodaysReading(): DevotionalMessage | null {
    return this.getReadingForDate(new Date());
  }

  public getTodaysReadingBasic(): DevotionalReading | null {
    const dateString = getDateString(new Date());
    return this.readings.find((r) => r.date === dateString) || null;
  }

  public getReadingForDate(date: Date): DevotionalMessage | null {
    const dateString = getDateString(date);
    const reading = this.readings.find((r) => r.date === dateString);
    if (!reading) return null;
    return {
      date: reading.date,
      formattedDate: formatDate(date),
      reading: reading.reading
    };
  }

  public getAllReadings(dateFilter?: string): DevotionalReading[] {
    if (!dateFilter) return [...this.readings];
    return this.readings.filter((reading) => reading.date === dateFilter);
  }

  public getReadingsCount(): number {
    return this.readings.length;
  }

  public validateReadings(): boolean {
    return Array.isArray(this.readings) && this.readings.every((r) => Boolean(r.date && r.reading));
  }

  private formatReadingForUrl(reading: string): string {
    return reading
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '%20');
  }

  private generateBibleGatewayLink(reading: string): string {
    return `https://www.biblegateway.com/passage/?search=${this.formatReadingForUrl(reading)}&version=NVI-PT&interface=print`;
  }

  public async formatMessage(devotional: DevotionalMessage): Promise<string> {
    const originalLink = this.generateBibleGatewayLink(devotional.reading);
    const link = this.urlShortener ? await this.urlShortener.shorten(originalLink) : originalLink;
    const audioLink = 'https://is.gd/rjLzat';
    return `📖 Leitura de hoje - ${devotional.formattedDate}\n\n${devotional.reading}\n\n🔗 Leia: ${link}\n\n🎧 Devocional em áudio: ${audioLink}`;
  }
}
