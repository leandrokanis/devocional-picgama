import { logger } from '../utils/logger.js';

export interface UrlShortenerConfig {
  enabled?: boolean;
  timeout?: number;
}

export class UrlShortenerService {
  private cache: Map<string, string> = new Map();
  private enabled: boolean;
  private timeout: number;
  private readonly API_URL = 'https://is.gd/create.php';

  constructor(config?: UrlShortenerConfig) {
    this.enabled = config?.enabled ?? process.env.URL_SHORTENER_ENABLED !== 'false';
    this.timeout = config?.timeout ?? 5000;
  }

  public async shorten(url: string): Promise<string> {
    if (!this.enabled) {
      return url;
    }

    if (!url || typeof url !== 'string' || url.trim() === '') {
      logger.warn('Invalid URL provided for shortening', { url });
      return url;
    }

    if (this.cache.has(url)) {
      const cached = this.cache.get(url);
      if (cached) {
        logger.debug('URL found in cache', { original: url, shortened: cached });
        return cached;
      }
    }

    try {
      const encodedUrl = encodeURIComponent(url);
      const apiUrl = `${this.API_URL}?format=json&url=${encodedUrl}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(apiUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'DevocionalBot/1.0'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }

      const data = await response.json() as { shorturl?: string; errorcode?: number; errormessage?: string };

      if (data.errorcode) {
        throw new Error(data.errormessage || `API error code: ${data.errorcode}`);
      }

      if (!data.shorturl || typeof data.shorturl !== 'string') {
        throw new Error('Invalid response from URL shortener API');
      }

      this.cache.set(url, data.shorturl);
      logger.debug('URL shortened successfully', { original: url, shortened: data.shorturl });
      return data.shorturl;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        logger.warn('URL shortening request timed out', { url, timeout: this.timeout });
      } else {
        logger.warn('Failed to shorten URL, using original', { url, error: error instanceof Error ? error.message : String(error) });
      }
      return url;
    }
  }

  public clearCache(): void {
    this.cache.clear();
    logger.debug('URL shortener cache cleared');
  }

  public getCacheSize(): number {
    return this.cache.size;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }
}
