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
  public onQRCodeGenerated?: (base64: string, ascii: string) => void;

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

      const browserOptions: any = {
        session: this.config.sessionName,
        headless: true,
        debug: this.config.debug,
        logQR: true,
        folderNameToken: tokensFolderName,
        disableSpins: true,
        disableWelcome: true,
        updatesLog: false,
        autoClose: 120000,
        createPathFileToken: true,
        browserArgs: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-extensions',
          '--disable-infobars',
          '--disable-features=IsolateOrigins,site-per-process',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-software-rasterizer',
          '--window-size=1280,720'
        ]
      };

      if (isProduction) {
        browserOptions.puppeteerOptions = {
          executablePath: executablePath || '/usr/bin/google-chrome-stable',
          args: browserOptions.browserArgs,
          headless: true,
          ignoreHTTPSErrors: true,
          ignoreDefaultArgs: ['--disable-extensions'],
          timeout: 180000,
          protocolTimeout: 180000,
          defaultViewport: { width: 1280, height: 720 }
        };
      }
      
      browserOptions.catchQR = (base64Qr: string, asciiQR: string, attempts: number) => {
        console.log('\n' + '='.repeat(80));
        console.log('📱 WHATSAPP QR CODE GERADO!');
        console.log('='.repeat(80));
        console.log(asciiQR);
        console.log('='.repeat(80));
        console.log('💡 Abra o WhatsApp no seu celular > Menu > Aparelhos conectados > Conectar um aparelho');
        console.log(`🔄 Tentativa ${attempts}/3`);
        console.log('🌐 Ou acesse: http://localhost:3001/qr para ver no navegador');
        console.log('='.repeat(80) + '\n');
        
        logger.info('📱 QR Code gerado com sucesso!');
        
        if (this.onQRCodeGenerated) {
          this.onQRCodeGenerated(base64Qr, asciiQR);
        }
      };

      browserOptions.logQR = true;

      browserOptions.statusFind = (statusSession: string, session: string) => {
        logger.info(`📱 WhatsApp status: ${statusSession} (${session})`);
        if (statusSession === 'authenticated') {
          logger.info('✅ WhatsApp autenticado com sucesso!');
        }
      };

      try {
        this.client = await create(browserOptions);
      } catch (createError: any) {
        if (createError?.message?.includes('already running') || createError?.message?.includes('browser is already running')) {
          logger.warn('Browser instance already running, attempting to force close...');
          await this.forceCloseBrowser();
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          try {
            this.client = await create(browserOptions);
          } catch (retryError) {
            logger.error('Error initializing WhatsApp client after retry', retryError);
            throw new Error('Failed to initialize WhatsApp client after cleanup attempt');
          }
        } else {
          throw createError;
        }
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
      
      // In production, if sending fails, at least log the message
      if (process.env.NODE_ENV === 'production') {
        logger.info('Failed to send via WhatsApp - Message content:', message);
      }
      
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

  public async forceReconnect(): Promise<void> {
    logger.info('🔄 Forcing WhatsApp reconnection...');
    
    this.isConnected = false;
    
    await this.close();
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    if (this.onQRCodeGenerated) {
      logger.info('🔄 Preparing for new QR code generation...');
    }
    
    await this.initialize();
  }

  private async forceCloseBrowser(): Promise<void> {
    if (this.client) {
      try {
        const clientAny = this.client as any;
        
        if (clientAny.browser) {
          try {
            const pages = await clientAny.browser.pages();
            for (const page of pages) {
              try {
                await page.close();
              } catch (error) {
                logger.debug('Error closing page during force close', error);
              }
            }
          } catch (error) {
            logger.debug('Error getting pages during force close', error);
          }
          
          try {
            await clientAny.browser.close();
            logger.info('Browser force closed successfully');
          } catch (error) {
            logger.debug('Error force closing browser', error);
          }
        }
        
        try {
          await this.client.close();
        } catch (error) {
          logger.debug('Error closing client during force close', error);
        }
      } catch (error) {
        logger.debug('Error during force close browser', error);
      }
      
      this.client = null;
      this.isConnected = false;
    }
  }

  public async close(): Promise<void> {
    if (this.client) {
      try {
        const clientAny = this.client as any;
        
        if (clientAny.browser) {
          try {
            const pages = await clientAny.browser.pages();
            for (const page of pages) {
              try {
                await page.close();
              } catch (error) {
                logger.debug('Error closing page', error);
              }
            }
          } catch (error) {
            logger.debug('Error getting pages', error);
          }
          
          try {
            await clientAny.browser.close();
            logger.info('Browser closed successfully');
          } catch (error) {
            logger.debug('Error closing browser directly', error);
          }
        }
        
        await this.client.close();
        logger.info('WhatsApp client closed');
      } catch (error) {
        logger.error('Error closing WhatsApp client', error);
      }
      
      this.client = null;
      this.isConnected = false;
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  public getConnectionStatus(): boolean {
    return this.isConnected;
  }
}
