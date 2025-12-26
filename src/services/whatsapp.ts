import { create, Whatsapp } from '@wppconnect-team/wppconnect';
import { logger } from '../utils/logger.js';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

export interface WhatsAppConfig {
  sessionName: string;
  groupChatId: string;
  headless?: boolean;
  debug?: boolean;
}

export class WhatsAppService {
  private client: Whatsapp | null = null;
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
      logger.info('Initializing WhatsApp client...');
      
      const isProduction = process.env.NODE_ENV === 'production';
      const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();

      const tokensBaseDir = process.env.TOKENS_DIR || tmpdir();
      const tokensFolderName = 'tokens';
      const tokensDir = join(tokensBaseDir, tokensFolderName);
      
      try {
        if (!existsSync(tokensDir)) {
          mkdirSync(tokensDir, { recursive: true });
        }
        logger.info(`Using tokens directory: ${tokensDir}`);
      } catch (error: any) {
        logger.error(`Failed to create tokens directory at ${tokensDir}`, error);
        throw error;
      }

      const originalCwd = process.cwd();
      let cwdChanged = false;
      
      try {
        process.chdir(tokensBaseDir);
        cwdChanged = true;
        logger.info(`Changed working directory to ${tokensBaseDir} for tokens`);
      } catch (error: any) {
        logger.warn(`Could not change working directory to ${tokensBaseDir}, using default: ${error.message}`);
      }

      try {
        const browserOptions: any = {
          session: this.config.sessionName,
          headless: this.config.headless,
          debug: this.config.debug,
          logQR: !isProduction,
          folderNameToken: tokensFolderName,
          browserArgs: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
          ]
        };

        if (isProduction && executablePath) {
          browserOptions.puppeteerOptions = { executablePath, args: browserOptions.browserArgs };
        }
        
        this.client = await create(browserOptions);
      } finally {
        if (cwdChanged) {
          try {
            process.chdir(originalCwd);
          } catch (error: any) {
            logger.warn(`Could not restore working directory to ${originalCwd}: ${error.message}`);
          }
        }
      }

      this.setupEventHandlers();
      this.isConnected = true;
      logger.info('WhatsApp client initialized successfully');
    } catch (error) {
      logger.error('Error initializing WhatsApp client', error);
      throw new Error('Failed to initialize WhatsApp client');
    }
  }

  private setupEventHandlers(): void {
    if (!this.client) return;

    this.client.onStateChange((state) => {
      logger.info('WhatsApp state changed', { state });
      this.isConnected = state === 'CONNECTED';
    });

    this.client.onMessage((message) => {
      if (this.config.debug) {
        logger.debug('Received message', message);
      }
    });
  }

  public async sendMessage(message: string): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      logger.error('WhatsApp client not connected');
      return false;
    }

    try {
      logger.info(`Sending message to group: ${this.config.groupChatId}`);
      await this.client.sendText(this.config.groupChatId, message);
      logger.info('Message sent successfully');
      return true;
    } catch (error) {
      logger.error('Error sending message', error);
      return false;
    }
  }

  public async sendDevotionalMessage(devotionalText: string): Promise<boolean> {
    return this.sendMessage(devotionalText);
  }

  public async checkConnection(): Promise<boolean> {
    if (!this.client) return false;

    try {
      const connectionState = await this.client.getConnectionState();
      this.isConnected = connectionState === 'CONNECTED';
      return this.isConnected;
    } catch (error) {
      logger.error('Error checking connection', error);
      this.isConnected = false;
      return false;
    }
  }

  public async reconnect(): Promise<void> {
    logger.info('Attempting to reconnect...');
    await this.close();
    await this.initialize();
  }

  public async close(): Promise<void> {
    if (this.client) {
      try {
        await this.client.close();
        logger.info('WhatsApp client closed');
      } catch (error) {
        logger.error('Error closing WhatsApp client', error);
      }
      this.client = null;
      this.isConnected = false;
    }
  }

  public getConnectionStatus(): boolean {
    return this.isConnected;
  }
}
