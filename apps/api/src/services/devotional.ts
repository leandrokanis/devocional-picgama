import { getDateString } from '../utils/date.js';
import type { ReadingsService } from './readings.js';
import type { UrlShortenerService } from './url-shortener.js';

export interface DevotionalMessage {
  date: string;
  formattedDate: string;
  passage: string;
  title: string;
  description: string;
  link: string;
}

export type ReadingSource = Pick<ReadingsService, 'get'>;
export type UrlShortener = Pick<UrlShortenerService, 'shorten'>;

const formatDateString = (date: string): string => {
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
};

const formatPassageForUrl = (passage: string): string =>
  passage
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '%20');

const bibleGatewayLink = (passage: string): string =>
  `https://www.biblegateway.com/passage/?search=${formatPassageForUrl(passage)}&version=NVI-PT&interface=print`;

export class DevotionalService {
  constructor(
    private readonly readings: ReadingSource,
    private readonly urlShortener: UrlShortener | null = null
  ) {}

  public async getTodaysReading(): Promise<DevotionalMessage | null> {
    return this.getReadingForDate(new Date());
  }

  public async getReadingForDate(date: Date): Promise<DevotionalMessage | null> {
    return this.getReading(getDateString(date));
  }

  public async getReading(date: string): Promise<DevotionalMessage | null> {
    const reading = await this.readings.get(date);
    if (!reading) return null;
    return {
      date: reading.date,
      formattedDate: formatDateString(reading.date),
      passage: reading.passage,
      title: reading.title,
      description: reading.description,
      link: reading.link
    };
  }

  public async formatReadingMessage(devotional: DevotionalMessage): Promise<string> {
    const originalLink = bibleGatewayLink(devotional.passage);
    const link = this.urlShortener ? await this.urlShortener.shorten(originalLink) : originalLink;
    return `Vamos ler a Bíblia hoje?\n\n📖 Leitura de hoje - ${devotional.formattedDate}\n\n${devotional.passage}\n\n🔗 Leia: ${link}`;
  }

  public formatDevotionalMessage(devotional: DevotionalMessage): string | null {
    if (devotional.title.trim() === '') return null;
    const lines = [`🎧 *${devotional.title}*`];
    if (devotional.description.trim() !== '') lines.push(devotional.description);
    if (devotional.link.trim() !== '') lines.push(`▶️ Ouça no Spotify: ${devotional.link}`);
    return lines.join('\n\n');
  }
}
