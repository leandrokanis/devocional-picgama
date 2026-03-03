import { logger } from '../utils/logger.js';

export interface UrlShortenerConfig {
  enabled?: boolean;
  timeout?: number;
}

export class UrlShortenerService {
  private cache: Map<string, string> = new Map();
  private enabled: boolean;
  private timeout: number;
  private readonly apiUrl = 'https://is.gd/create.php';

  constructor(config?: UrlShortenerConfig) {
    this.enabled = config?.enabled ?? process.env.URL_SHORTENER_ENABLED !== 'false';
    this.timeout = config?.timeout ?? 5000;
  }

  public async shorten(url: string): Promise<string> {
    if (!this.enabled) return url;
    if (!url || typeof url !== 'string' || url.trim() === '') return url;

    const cached = this.cache.get(url);
    if (cached) return cached;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      const response = await fetch(`${this.apiUrl}?format=json&url=${encodeURIComponent(url)}`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'DevocionalBot/1.0'
        }
      });
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`API returned status ${response.status}`);
      const data = await response.json() as { shorturl?: string; errorcode?: number; errormessage?: string };
      if (data.errorcode || !data.shorturl) throw new Error(data.errormessage || 'Invalid response');

      this.cache.set(url, data.shorturl);
      return data.shorturl;
    } catch (error) {
      logger.warn('Failed to shorten URL, using original', { url, error: error instanceof Error ? error.message : String(error) });
      return url;
    }
  }
}
