import makeWASocket, { 
  DisconnectReason, 
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  type WASocket
} from '@whiskeysockets/baileys';
import { useMongoDBAuthState } from 'mongo-baileys';
import * as QRCode from 'qrcode';
import { logger } from '../utils/logger.js';
import { mongoService } from './mongodb.js';
import { existsSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import pino from 'pino';

export interface WhatsAppConfig {
  sessionName: string;
  groupChatId: string;
  headless?: boolean;
  debug?: boolean;
}

export class WhatsAppService {
  private sock: WASocket | null = null;
  private config: WhatsAppConfig;
  private isConnected = false;
  public onQRCodeGenerated?: (base64: string, ascii: string) => void;
  private authDir: string;

  constructor(config: WhatsAppConfig) {
    this.config = config;
    const tokensBaseDir = process.env.TOKENS_DIR || tmpdir();
    // Use a folder specific to the session (fallback for local development)
    this.authDir = join(tokensBaseDir, 'baileys_auth_info');
  }

  public async initialize(): Promise<void> {
    try {
      logger.info('Initializing WhatsApp client (Baileys)...');
      await this.connectToWhatsApp();
    } catch (error) {
      logger.error('Error initializing WhatsApp client', error);
      throw error;
    }
  }

  private async connectToWhatsApp() {
    let state: any;
    let saveCreds: any;

    // Try MongoDB first, fallback to file system for local development
    const useMongoAuth = process.env.MONGODB_URI && process.env.NODE_ENV === 'production';
    
    if (useMongoAuth) {
      try {
        await mongoService.ensureConnection();
        const collection = mongoService.getAuthCollection();
        const mongoAuth = await useMongoDBAuthState(collection as any);
        state = mongoAuth.state;
        saveCreds = mongoAuth.saveCreds;
        logger.info('Using MongoDB for auth state storage');
      } catch (error) {
        logger.error('Failed to use MongoDB auth state, falling back to file system:', error);
        const fileAuth = await useMultiFileAuthState(this.authDir);
        state = fileAuth.state;
        saveCreds = fileAuth.saveCreds;
      }
    } else {
      const fileAuth = await useMultiFileAuthState(this.authDir);
      state = fileAuth.state;
      saveCreds = fileAuth.saveCreds;
      logger.info('Using file system for auth state storage');
    }

    this.sock = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })) 
      },
      printQRInTerminal: false,
      logger: pino({ level: this.config.debug ? "debug" : "silent" }) as any,
      browser: ["Devocional Bot", "Chrome", "1.0.0"],
      generateHighQualityLinkPreview: true,
    });

    this.sock.ev.on('creds.update', saveCreds);

    this.sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        logger.info('QR Code received');
        try {
          const base64 = await QRCode.toDataURL(qr);
          if (this.onQRCodeGenerated) {
            this.onQRCodeGenerated(base64, qr);
          }
        } catch (err) {
          logger.error('Failed to generate QR code image', err);
        }
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        
        logger.warn(`Connection closed due to ${lastDisconnect?.error}, reconnecting: ${shouldReconnect}`);
        this.isConnected = false;
        
        if (shouldReconnect) {
          // Add a small delay before reconnecting to avoid tight loops
          setTimeout(() => this.connectToWhatsApp(), 2000);
        } else {
            logger.error('Connection closed. You are logged out.');
            // If logged out, we might want to clean credentials
            if (statusCode === DisconnectReason.loggedOut) {
               await this.forceReconnect();
            }
        }
      } else if (connection === 'open') {
        logger.info('✅ WhatsApp opened connection');
        this.isConnected = true;
      }
    });
  }

  public async sendMessage(message: string): Promise<boolean> {
    if (!this.sock || !this.isConnected) {
        logger.error('WhatsApp client not connected');
        return false;
    }

    try {
        // Handle group JIDs correctly. If it doesn't end in @g.us, append it?
        // Usually config.groupChatId should be correct.
        await this.sock.sendMessage(this.config.groupChatId, { text: message });
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
    return this.isConnected;
  }

  public async reconnect(): Promise<void> {
     await this.close();
     await this.initialize();
  }

  public async forceReconnect(): Promise<void> {
    logger.info('🔄 Forcing WhatsApp reconnection with session cleanup...');
    await this.close();
    
    if (existsSync(this.authDir)) {
        try {
            rmSync(this.authDir, { recursive: true, force: true });
            logger.info('Auth directory deleted');
        } catch (error) {
            logger.error('Failed to delete auth directory', error);
        }
    }
    
    // Slight delay to ensure filesystem operations complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await this.initialize();
  }

  public async close(): Promise<void> {
    if (this.sock) {
        try {
            this.sock.end(undefined);
        } catch (e) {
            logger.error('Error closing socket', e);
        }
        this.sock = null;
        this.isConnected = false;
    }
    
    // Close MongoDB connection if it was used
    if (process.env.MONGODB_URI && process.env.NODE_ENV === 'production') {
      try {
        await mongoService.disconnect();
      } catch (e) {
        logger.error('Error closing MongoDB connection', e);
      }
    }
  }

  public getConnectionStatus(): boolean {
    return this.isConnected;
  }
}
