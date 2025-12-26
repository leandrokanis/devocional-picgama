import { logger } from '../utils/logger.js';

export interface WhatsAppConfig {
  sessionName: string;
  groupChatId: string;
  headless?: boolean;
  debug?: boolean;
}

/**
 * Fallback WhatsApp service for environments where wppconnect fails
 * This service logs messages instead of sending them via WhatsApp
 */
export class WhatsAppFallbackService {
  private config: WhatsAppConfig;
  private isConnected = false;

  constructor(config: WhatsAppConfig) {
    this.config = {
      headless: true,
      debug: false,
      ...config
    };
  }

  public async initialize(): Promise<void> {
    try {
      logger.info('Initializing WhatsApp fallback service...');
      
      // Simulate initialization delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      this.isConnected = true;
      logger.info('WhatsApp fallback service initialized successfully');
      logger.warn('⚠️ Using fallback service - messages will be logged instead of sent');
    } catch (error) {
      logger.error('Error initializing WhatsApp fallback service', error);
      throw new Error('Failed to initialize WhatsApp fallback service');
    }
  }

  public async sendMessage(message: string): Promise<boolean> {
    if (!this.isConnected) {
      logger.error('WhatsApp fallback service not connected');
      return false;
    }

    try {
      logger.info(`📱 [FALLBACK] Would send message to group: ${this.config.groupChatId}`);
      logger.info(`📝 [FALLBACK] Message content:\n${message}`);
      logger.info('✅ [FALLBACK] Message logged successfully');
      return true;
    } catch (error) {
      logger.error('Error logging message', error);
      return false;
    }
  }

  public async sendDevotionalMessage(devotionalText: string): Promise<boolean> {
    return this.sendMessage(devotionalText);
  }

  public async checkConnection(): Promise<boolean> {
    return this.isConnected;
  }

  public async reconnect(): Promise<void> {
    logger.info('Attempting to reconnect fallback service...');
    await this.close();
    await this.initialize();
  }

  public async close(): Promise<void> {
    if (this.isConnected) {
      logger.info('WhatsApp fallback service closed');
      this.isConnected = false;
    }
  }

  public getConnectionStatus(): boolean {
    return this.isConnected;
  }
}
