import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  type WASocket
} from '@whiskeysockets/baileys';
import * as QRCode from 'qrcode';
import pino from 'pino';
import { logger } from '../utils/logger.js';
import { WhatsAppAuthService } from './whatsapp-auth.js';

export interface WhatsAppConfig {
  sessionName: string;
  debug?: boolean;
}

export class WhatsAppService {
  private sock: WASocket | null = null;
  private config: WhatsAppConfig;
  private isConnected = false;
  public onQRCodeGenerated?: (base64: string) => void;
  private authService: WhatsAppAuthService;
  private intentionalClose = false;
  private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(config: WhatsAppConfig) {
    this.config = config;
    this.authService = new WhatsAppAuthService(config.sessionName);
  }

  public async initialize(): Promise<void> {
    await this.connectToWhatsApp();
  }

  private async connectToWhatsApp(): Promise<void> {
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
    if (this.sock) {
      this.intentionalClose = true;
      this.sock.end(undefined);
      this.sock = null;
      this.isConnected = false;
      setImmediate(() => { this.intentionalClose = false; });
    }

    const { state, saveCreds } = await this.authService.useAuthState();
    const { version } = await fetchLatestBaileysVersion();
    this.sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
      },
      printQRInTerminal: false,
      logger: pino({ level: this.config.debug ? 'debug' : 'silent' }) as never,
      browser: ['Devocional Bot', 'Chrome', '1.0.0'],
      generateHighQualityLinkPreview: true
    });
    const currentSock = this.sock;
    this.sock.ev.on('creds.update', saveCreds);

    this.sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        logger.info('QR Code received');
        const terminalQR = await QRCode.toString(qr, { type: 'terminal', small: true });
        console.log(`\n${terminalQR}\n`);
        const base64 = await QRCode.toDataURL(qr);
        if (this.onQRCodeGenerated) this.onQRCodeGenerated(base64);
      }

      if (connection === 'open') {
        this.isConnected = true;
        logger.info('WhatsApp connected');
        return;
      }

      if (connection === 'close') {
        if (this.intentionalClose) return;
        if (this.sock !== currentSock) return;
        const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } })?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        this.isConnected = false;
        this.sock = null;
        if (shouldReconnect) {
          this.reconnectTimeoutId = setTimeout(() => {
            this.reconnectTimeoutId = null;
            void this.connectToWhatsApp();
          }, 2000);
        } else {
          await this.forceReconnect();
        }
      }
    });
  }

  public async sendMessage(message: string, chatId: string): Promise<boolean> {
    if (!this.sock || !this.isConnected) return false;
    const target = chatId.trim();
    if (!target) return false;
    try {
      await this.sock.sendMessage(target, { text: message });
      return true;
    } catch (error) {
      logger.error('Error sending message', error);
      return false;
    }
  }

  public async sendDevotionalMessage(devotionalText: string, chatId: string): Promise<boolean> {
    return this.sendMessage(devotionalText, chatId);
  }

  public async checkConnection(): Promise<boolean> {
    return this.isConnected;
  }

  public async forceReconnect(): Promise<void> {
    await this.close();
    await this.authService.clearAuth();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await this.initialize();
  }

  public async close(): Promise<void> {
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
    if (!this.sock) return;
    this.intentionalClose = true;
    this.sock.end(undefined);
    this.sock = null;
    this.isConnected = false;
    setImmediate(() => { this.intentionalClose = false; });
  }

  public getConnectionStatus(): boolean {
    return this.isConnected;
  }
}
