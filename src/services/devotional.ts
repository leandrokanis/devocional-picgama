import { readFileSync } from 'fs';
import { join } from 'path';
import { getDateString, formatDate } from '../utils/date.js';
import { logger } from '../utils/logger.js';

export interface DevotionalReading {
  date: string;
  at1: string;
  at2: string;
  nt: string;
}

export interface DevotionalMessage {
  date: string;
  formattedDate: string;
  at1: string;
  at2: string;
  nt: string;
}

export class DevotionalService {
  private readings: DevotionalReading[] = [];
  private dataPath: string;

  constructor(dataPath?: string) {
    this.dataPath = dataPath || join(process.cwd(), 'data', 'leituras.json');
    this.loadReadings();
  }

  private loadReadings(): void {
    try {
      const fileContent = readFileSync(this.dataPath, 'utf-8');
      this.readings = JSON.parse(fileContent);
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
      at1: reading.at1,
      at2: reading.at2,
      nt: reading.nt
    };
  }

  public getTodaysReading(): DevotionalMessage | null {
    return this.getReadingForDate(new Date());
  }

  public getTodaysReadingBasic(): DevotionalReading | null {
    const dateString = getDateString(new Date());
    return this.readings.find(r => r.date === dateString) || null;
  }

  public formatMessage(devotional: DevotionalMessage): string {
    return `📖 Devocional - ${devotional.formattedDate}

AT1: ${devotional.at1}
AT2: ${devotional.at2}
NT: ${devotional.nt}`;
  }

  public validateReadings(): boolean {
    if (!Array.isArray(this.readings)) {
      logger.error('Readings data is not an array');
      return false;
    }

    for (const reading of this.readings) {
      if (!reading.date || !reading.at1 || !reading.at2 || !reading.nt) {
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
