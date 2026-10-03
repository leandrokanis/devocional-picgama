import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomBytes, timingSafeEqual } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
import { createServer } from 'http';
import type { IncomingMessage, ServerResponse } from 'http';
import { existsSync, mkdirSync } from 'fs';
import { readFile } from 'fs/promises';
import { networkInterfaces } from 'os';
import { prisma } from './prisma.js';
import { AudioService, AudioUploadError } from './services/audio.js';
import { FfmpegAudioConverter } from './services/audio-converter.js';
import { DevotionalService } from './services/devotional.js';
import { DevotionalSender } from './services/devotional-sender.js';
import {
  ReadingError,
  ReadingsService,
  type ReadingErrorReason,
  type ReadingInput,
  type ReadingUpdate
} from './services/readings.js';
import { RecipientsService } from './services/recipients.js';
import { SchedulerService } from './services/scheduler.js';
import { UrlShortenerService } from './services/url-shortener.js';
import { WhatsAppService } from './services/whatsapp.js';
import { getDateString } from './utils/date.js';
import { logger } from './utils/logger.js';

type RecipientPayload = {
  chat_id?: string;
  name?: string;
  type?: string;
};

type LoginPayload = {
  user?: string;
  password?: string;
};

const BYTES_PER_MB = 1024 * 1024;
const MULTIPART_OVERHEAD_BYTES = 1 * BYTES_PER_MB;
const AUDIO_ROUTE = /^\/(?:api\/)?readings\/(\d{4}-\d{2}-\d{2})\/audio$/;
const READINGS_ROUTE = /^\/(?:api\/)?readings$/;
const READINGS_IMPORT_ROUTE = /^\/(?:api\/)?readings\/import$/;
const READING_ROUTE = /^\/(?:api\/)?readings\/(\d{4}-\d{2}-\d{2})$/;
const READING_ERROR_STATUS: Record<ReadingErrorReason, number> = { invalid: 400, not_found: 404, conflict: 409 };

const resolveAudioConfig = () => {
  const audioDir = process.env.AUDIO_DIR?.trim() || path.resolve(__dirname, '../../../data/audio');
  const maxUploadMb = Number.parseFloat(process.env.AUDIO_MAX_UPLOAD_MB || '');
  const maxBytes = Math.floor((Number.isFinite(maxUploadMb) && maxUploadMb > 0 ? maxUploadMb : 15) * BYTES_PER_MB);
  return { audioDir, maxBytes, maxRequestBytes: maxBytes + MULTIPART_OVERHEAD_BYTES };
};

class DevotionalBot {
  private devotionalService: DevotionalService;
  private whatsappService: WhatsAppService;
  private devotionalSender: DevotionalSender;
  private schedulerService: SchedulerService;
  private isInitialized = false;
  public recipientsService: RecipientsService;
  public currentQRCode: string | null = null;

  constructor(audioService: AudioService, readingsService: ReadingsService) {
    const urlShortener = new UrlShortenerService();
    this.devotionalService = new DevotionalService(readingsService, urlShortener);
    this.whatsappService = new WhatsAppService({
      sessionName: process.env.WHATSAPP_SESSION_NAME || 'devocional-bot',
      debug: process.env.DEBUG === 'true'
    });
    this.recipientsService = new RecipientsService();
    this.devotionalSender = new DevotionalSender(this.devotionalService, audioService, this.whatsappService);
    this.whatsappService.onQRCodeGenerated = (base64: string) => {
      this.currentQRCode = base64;
    };
    this.schedulerService = new SchedulerService({
      sendTime: process.env.SEND_TIME || '06:00',
      timezone: process.env.TIMEZONE || 'America/Sao_Paulo',
      onExecute: async () => this.sendTodaysDevotional()
    });
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;
    await this.whatsappService.initialize();
    this.isInitialized = true;
  }

  public async sendTodaysDevotional(): Promise<boolean> {
    try {
      if (!this.isInitialized) await this.initialize();
      const todaysReading = await this.findTodaysReading();
      if (!todaysReading) return false;
      const recipients = await this.recipientsService.getAll();
      if (!recipients.length) return false;
      return await this.devotionalSender.send(todaysReading, recipients.map((recipient) => recipient.chatId));
    } catch (error) {
      logger.error('Error sending devotional', error);
      return false;
    }
  }

  public async sendTodaysDevotionalToRecipient(recipientId: number): Promise<boolean> {
    try {
      if (!this.isInitialized) await this.initialize();
      const recipient = await this.recipientsService.getById(recipientId);
      if (!recipient) return false;
      const todaysReading = await this.findTodaysReading();
      if (!todaysReading) return false;
      return await this.devotionalSender.send(todaysReading, [recipient.chatId]);
    } catch (error) {
      logger.error('Error sending devotional to recipient', error);
      return false;
    }
  }

  private async findTodaysReading() {
    const todaysReading = await this.devotionalService.getTodaysReading();
    if (!todaysReading) logger.warn(`No reading scheduled for ${getDateString(new Date())}; nothing was sent`);
    return todaysReading;
  }

  public async close(): Promise<void> {
    this.schedulerService.stop();
    await this.whatsappService.close();
    await prisma.$disconnect();
  }

  public async forceWhatsAppReconnect(): Promise<boolean> {
    try {
      this.isInitialized = false;
      this.currentQRCode = null;
      await this.whatsappService.forceReconnect();
      this.isInitialized = true;
      return true;
    } catch (error) {
      logger.error('Failed to force WhatsApp reconnection', error);
      this.isInitialized = false;
      return false;
    }
  }

  public getConnectionStatus(): boolean {
    return this.isInitialized && this.whatsappService.getConnectionStatus();
  }

  public getSchedulerStatus() {
    return this.schedulerService.getStatus();
  }

  public startScheduler(): void {
    this.schedulerService.start();
  }

  public stopScheduler(): void {
    this.schedulerService.stop();
  }
}

const addCorsHeaders = (headers: Record<string, string> = {}) => ({
  ...headers,
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Max-Age': '86400'
});

const parseJsonBody = async <T>(req: Request): Promise<T | null> => {
  try {
    return await req.json() as T;
  } catch {
    return null;
  }
};

const runtimeAuthToken = process.env.AUTH_TOKEN?.trim() || randomBytes(32).toString('hex');

const secureEqual = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
};

const checkAuth = (req: Request): Response | null => {
  const authToken = runtimeAuthToken;
  const url = new URL(req.url);
  const queryToken = url.searchParams.get('token');
  const authHeader = req.headers.get('Authorization');
  const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  const token = (headerToken || queryToken)?.trim() ?? '';
  if (!token || !secureEqual(token, authToken)) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401,
      headers: addCorsHeaders({ 'Content-Type': 'application/json' })
    });
  }
  return null;
};

const getLocalIP = () => {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    const group = nets[name];
    if (!group) continue;
    for (const net of group) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return null;
};

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: addCorsHeaders({ 'Content-Type': 'application/json' })
  });

const readingErrorResponse = (error: unknown, action: string) => {
  if (error instanceof ReadingError) return jsonResponse(READING_ERROR_STATUS[error.reason], { success: false, error: error.message });
  logger.error(`Failed to ${action}`, error);
  return jsonResponse(500, { success: false, error: `Failed to ${action}` });
};

const isTooLargeAudioUpload = (method: string | undefined, pathname: string, contentLength: number, maxRequestBytes: number) =>
  method === 'PUT' && AUDIO_ROUTE.test(pathname) && contentLength > maxRequestBytes;

async function main() {
  const audioConfig = resolveAudioConfig();
  mkdirSync(audioConfig.audioDir, { recursive: true });
  const audioService = new AudioService(prisma, new FfmpegAudioConverter(), audioConfig.audioDir, audioConfig.maxBytes);
  const readingsService = new ReadingsService(prisma, audioService);
  const bot = new DevotionalBot(audioService, readingsService);
  const command = process.argv[2];

  if (command === 'send') {
    const baseUrl = process.env.SERVER_URL
      ? process.env.SERVER_URL.replace(/\/$/, '')
      : `http://${process.env.SERVER_HOST || 'localhost'}:${process.env.PORT || '4000'}`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (process.env.AUTH_TOKEN) headers.Authorization = `Bearer ${process.env.AUTH_TOKEN}`;
    const response = await fetch(`${baseUrl}/send`, { method: 'POST', headers });
    const result = await response.json() as { success?: boolean; error?: string };
    if (!response.ok || !result.success) process.exit(1);
    process.exit(0);
  }

  const port = parseInt(process.env.PORT || '4000', 10);
  const hostname = process.env.SERVER_HOST || '0.0.0.0';
  let botInitialized = false;

  const tryInitializeBot = async () => {
    if (botInitialized) return true;
    try {
      await bot.initialize();
      botInitialized = true;
      return true;
    } catch (error) {
      logger.warn('Bot initialization failed, server will continue running', error);
      return false;
    }
  };

  const fetchHandler = async (req: Request) => {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: addCorsHeaders() });
    }

    if (url.pathname === '/auth/login' && req.method === 'POST') {
      const adminUser = process.env.ADMIN_USER?.trim() ?? '';
      const adminPassword = process.env.ADMIN_PASSWORD?.trim() ?? '';
      if (!adminUser || !adminPassword) {
        return new Response(JSON.stringify({ success: false, error: 'Login is not configured' }), {
          status: 500,
          headers: addCorsHeaders({ 'Content-Type': 'application/json' })
        });
      }
      const payload = await parseJsonBody<LoginPayload>(req);
      if (!payload) {
        return new Response(JSON.stringify({ success: false, error: 'Invalid JSON body' }), {
          status: 400,
          headers: addCorsHeaders({ 'Content-Type': 'application/json' })
        });
      }
      const user = payload.user?.trim() ?? '';
      const password = payload.password?.trim() ?? '';
      if (!user || !password) {
        return new Response(JSON.stringify({ success: false, error: 'User and password are required' }), {
          status: 400,
          headers: addCorsHeaders({ 'Content-Type': 'application/json' })
        });
      }
      const validUser = secureEqual(user, adminUser);
      const validPassword = secureEqual(password, adminPassword);
      if (!validUser || !validPassword) {
        return new Response(JSON.stringify({ success: false, error: 'Invalid credentials' }), {
          status: 401,
          headers: addCorsHeaders({ 'Content-Type': 'application/json' })
        });
      }
      return new Response(JSON.stringify({ success: true, token: runtimeAuthToken }), {
        status: 200,
        headers: addCorsHeaders({ 'Content-Type': 'application/json' })
      });
    }

    if (url.pathname === '/api/recipients' && req.method === 'GET') {
      const authError = checkAuth(req);
      if (authError) return authError;
      const data = await bot.recipientsService.getAll();
      return new Response(JSON.stringify({ data }), {
        status: 200,
        headers: addCorsHeaders({ 'Content-Type': 'application/json' })
      });
    }

    if (url.pathname === '/api/recipients' && req.method === 'POST') {
      const authError = checkAuth(req);
      if (authError) return authError;
      const payload = await parseJsonBody<RecipientPayload>(req);
      if (!payload) {
        return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
          status: 400,
          headers: addCorsHeaders({ 'Content-Type': 'application/json' })
        });
      }
      try {
        const created = await bot.recipientsService.create(
          payload.chat_id || '',
          payload.name || '',
          (payload.type || '') as 'group' | 'person'
        );
        return new Response(JSON.stringify(created), {
          status: 201,
          headers: addCorsHeaders({ 'Content-Type': 'application/json' })
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create recipient';
        return new Response(JSON.stringify({ error: message }), {
          status: 400,
          headers: addCorsHeaders({ 'Content-Type': 'application/json' })
        });
      }
    }

    const recipientSendMatch = url.pathname.match(/^\/(?:api\/)?recipients\/(\d+)\/send$/);
    if (recipientSendMatch && req.method === 'POST') {
      const authError = checkAuth(req);
      if (authError) return authError;
      const recipientId = parseInt(recipientSendMatch[1]!, 10);
      const success = await bot.sendTodaysDevotionalToRecipient(recipientId);
      return new Response(JSON.stringify(
        success ? { success: true, message: 'Devotional sent successfully' } : { success: false, error: 'Failed to send devotional' }
      ), {
        status: success ? 200 : 500,
        headers: addCorsHeaders({ 'Content-Type': 'application/json' })
      });
    }

    const recipientMatch = url.pathname.match(/^\/api\/recipients\/(\d+)$/);
    if (recipientMatch) {
      const authError = checkAuth(req);
      if (authError) return authError;
      const recipientId = parseInt(recipientMatch[1]!, 10);
      if (req.method === 'GET') {
        const recipient = await bot.recipientsService.getById(recipientId);
        if (!recipient) {
          return new Response(JSON.stringify({ error: 'Recipient not found' }), {
            status: 404,
            headers: addCorsHeaders({ 'Content-Type': 'application/json' })
          });
        }
        return new Response(JSON.stringify(recipient), {
          status: 200,
          headers: addCorsHeaders({ 'Content-Type': 'application/json' })
        });
      }
      if (req.method === 'PUT') {
        const payload = await parseJsonBody<RecipientPayload>(req);
        if (!payload) {
          return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
            status: 400,
            headers: addCorsHeaders({ 'Content-Type': 'application/json' })
          });
        }
        try {
          const updated = await bot.recipientsService.update(
            recipientId,
            payload.chat_id || '',
            payload.name || '',
            (payload.type || '') as 'group' | 'person'
          );
          return new Response(JSON.stringify(updated), {
            status: 200,
            headers: addCorsHeaders({ 'Content-Type': 'application/json' })
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to update recipient';
          return new Response(JSON.stringify({ error: message }), {
            status: message.includes('not found') ? 404 : 400,
            headers: addCorsHeaders({ 'Content-Type': 'application/json' })
          });
        }
      }
      if (req.method === 'DELETE') {
        const deleted = await bot.recipientsService.delete(recipientId);
        if (!deleted) {
          return new Response(JSON.stringify({ error: 'Recipient not found' }), {
            status: 404,
            headers: addCorsHeaders({ 'Content-Type': 'application/json' })
          });
        }
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: addCorsHeaders({ 'Content-Type': 'application/json' })
        });
      }
    }

    if (url.pathname === '/send' && req.method === 'POST') {
      const authError = checkAuth(req);
      if (authError) return authError;
      const success = await bot.sendTodaysDevotional();
      return new Response(JSON.stringify(
        success ? { success: true, message: 'Devotional sent successfully' } : { success: false, error: 'Failed to send devotional' }
      ), {
        status: success ? 200 : 500,
        headers: addCorsHeaders({ 'Content-Type': 'application/json' })
      });
    }

    if (url.pathname === '/health' && req.method === 'GET') {
      return new Response(JSON.stringify({
        status: 'ok',
        connected: bot.getConnectionStatus(),
        hasQRCode: bot.currentQRCode !== null,
        scheduler: bot.getSchedulerStatus()
      }), {
        status: 200,
        headers: addCorsHeaders({ 'Content-Type': 'application/json' })
      });
    }

    if (url.pathname === '/qr' && req.method === 'GET') {
      const authError = checkAuth(req);
      if (authError) return authError;
      if (url.searchParams.get('reconnect') === 'true') {
        const reconnectOk = await bot.forceWhatsAppReconnect();
        if (!reconnectOk) {
          return new Response(JSON.stringify({
            success: false,
            connected: bot.getConnectionStatus(),
            qr: null,
            message: 'Failed to force WhatsApp reconnection'
          }), {
            status: 500,
            headers: addCorsHeaders({ 'Content-Type': 'application/json' })
          });
        }
      }
      const connected = bot.getConnectionStatus();
      const qr = connected ? null : bot.currentQRCode;
      return new Response(JSON.stringify({
        success: true,
        connected,
        qr,
        message: connected ? 'WhatsApp is connected' : qr ? 'Scan the QR code with WhatsApp' : 'No QR code available at the moment'
      }), {
        status: 200,
        headers: addCorsHeaders({ 'Content-Type': 'application/json' })
      });
    }

    const audioMatch = url.pathname.match(AUDIO_ROUTE);
    if (audioMatch && ['PUT', 'DELETE', 'GET'].includes(req.method)) {
      const authError = checkAuth(req);
      if (authError) return authError;
      const date = audioMatch[1]!;

      if (req.method === 'PUT') {
        if (!(await readingsService.get(date))) return jsonResponse(404, { success: false, error: 'No reading found for this date' });
        let file: unknown;
        try {
          file = (await req.formData()).get('file');
        } catch {
          return jsonResponse(400, { success: false, error: 'Expected a multipart/form-data body' });
        }
        if (!(file instanceof File)) return jsonResponse(400, { success: false, error: 'Missing "file" field' });
        try {
          const audio = await audioService.save(date, {
            originalName: file.name,
            mimeType: file.type,
            data: Buffer.from(await file.arrayBuffer())
          });
          return jsonResponse(200, { success: true, data: audio });
        } catch (error) {
          if (error instanceof AudioUploadError) {
            if (error.reason === 'conversion_failed') logger.warn(`Audio conversion failed for ${date}`, error.message);
            return jsonResponse(error.reason === 'too_large' ? 413 : 400, { success: false, error: error.message });
          }
          logger.error('Failed to save audio', error);
          return jsonResponse(500, { success: false, error: 'Failed to save audio' });
        }
      }

      if (req.method === 'DELETE') {
        const removed = await audioService.remove(date);
        if (!removed) return jsonResponse(404, { success: false, error: 'No audio for this date' });
        return jsonResponse(200, { success: true });
      }

      const audio = await audioService.readFile(date);
      if (!audio) return jsonResponse(404, { success: false, error: 'No audio for this date' });
      return new Response(new Uint8Array(audio), {
        status: 200,
        headers: addCorsHeaders({
          'Content-Type': 'audio/ogg',
          'Content-Length': String(audio.length),
          'Cache-Control': 'no-store'
        })
      });
    }

    if (url.pathname === '/readings/today' && req.method === 'GET') {
      const reading = await readingsService.get(getDateString(new Date()));
      if (!reading) return jsonResponse(404, { error: 'No devotional reading found for today' });
      return jsonResponse(200, reading);
    }

    if (READINGS_ROUTE.test(url.pathname) && req.method === 'GET') {
      const date = url.searchParams.get('date') || undefined;
      const range = {
        from: url.searchParams.get('from') || date,
        to: url.searchParams.get('to') || date
      };
      const readings = await readingsService.list(range);
      return jsonResponse(200, {
        data: readings,
        metadata: { count: readings.length, ...(range.from || range.to ? { range } : {}) }
      });
    }

    if (READINGS_ROUTE.test(url.pathname) && req.method === 'POST') {
      const authError = checkAuth(req);
      if (authError) return authError;
      const payload = await parseJsonBody<unknown>(req);
      if (!payload) return jsonResponse(400, { success: false, error: 'Invalid JSON body' });
      try {
        return jsonResponse(201, { success: true, data: await readingsService.create(payload as ReadingInput) });
      } catch (error) {
        return readingErrorResponse(error, 'create reading');
      }
    }

    if (READINGS_IMPORT_ROUTE.test(url.pathname) && req.method === 'POST') {
      const authError = checkAuth(req);
      if (authError) return authError;
      const payload = await parseJsonBody<unknown>(req);
      try {
        const result = await readingsService.import(payload);
        return jsonResponse(200, { success: true, ...result });
      } catch (error) {
        return readingErrorResponse(error, 'import readings');
      }
    }

    const readingMatch = url.pathname.match(READING_ROUTE);
    if (readingMatch && req.method === 'GET') {
      const reading = await readingsService.get(readingMatch[1]!);
      if (!reading) return jsonResponse(404, { success: false, error: 'No reading found for this date' });
      return jsonResponse(200, { success: true, data: reading });
    }

    if (readingMatch && ['PUT', 'DELETE'].includes(req.method)) {
      const authError = checkAuth(req);
      if (authError) return authError;
      const date = readingMatch[1]!;
      if (req.method === 'DELETE') {
        try {
          await readingsService.remove(date);
          return new Response(null, { status: 204, headers: addCorsHeaders() });
        } catch (error) {
          return readingErrorResponse(error, 'delete reading');
        }
      }
      const payload = await parseJsonBody<unknown>(req);
      if (!payload || typeof payload !== 'object') return jsonResponse(400, { success: false, error: 'Invalid JSON body' });
      try {
        return jsonResponse(200, { success: true, data: await readingsService.update(date, payload as ReadingUpdate) });
      } catch (error) {
        return readingErrorResponse(error, 'update reading');
      }
    }

    if (url.pathname === '/scheduler/status' && req.method === 'GET') {
      return new Response(JSON.stringify(bot.getSchedulerStatus()), {
        status: 200,
        headers: addCorsHeaders({ 'Content-Type': 'application/json' })
      });
    }

    if (url.pathname === '/scheduler/start' && req.method === 'POST') {
      const authError = checkAuth(req);
      if (authError) return authError;
      bot.startScheduler();
      return new Response(JSON.stringify({ success: true, message: 'Scheduler started successfully' }), {
        status: 200,
        headers: addCorsHeaders({ 'Content-Type': 'application/json' })
      });
    }

    if (url.pathname === '/scheduler/stop' && req.method === 'POST') {
      const authError = checkAuth(req);
      if (authError) return authError;
      bot.stopScheduler();
      return new Response(JSON.stringify({ success: true, message: 'Scheduler stopped successfully' }), {
        status: 200,
        headers: addCorsHeaders({ 'Content-Type': 'application/json' })
      });
    }

    if (url.pathname === '/docs' && req.method === 'GET') {
      const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>Devocional API - Swagger UI</title><link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"/></head><body><div id="swagger-ui"></div><script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script><script>window.onload=()=>{window.ui=SwaggerUIBundle({url:'/api-docs',dom_id:'#swagger-ui',deepLinking:true,presets:[SwaggerUIBundle.presets.apis]});};</script></body></html>`;
      return new Response(html, {
        status: 200,
        headers: addCorsHeaders({ 'Content-Type': 'text/html; charset=utf-8' })
      });
    }

    if (url.pathname === '/api-docs' && req.method === 'GET') {
      try {
        const swaggerPaths = [
          './src/swagger.json',
          './dist/swagger.json',
          new URL('./swagger.json', import.meta.url).pathname
        ];
        let swaggerData: Record<string, unknown> | null = null;
        for (const path of swaggerPaths) {
          if (!existsSync(path)) continue;
          swaggerData = JSON.parse(await readFile(path, 'utf-8'));
          break;
        }
        if (!swaggerData) throw new Error('Swagger spec file not found');
        return new Response(JSON.stringify(swaggerData), {
          status: 200,
          headers: addCorsHeaders({ 'Content-Type': 'application/json' })
        });
      } catch {
        return new Response(JSON.stringify({ error: 'Failed to load API documentation' }), {
          status: 500,
          headers: addCorsHeaders({ 'Content-Type': 'application/json' })
        });
      }
    }

    if (url.pathname === '/' && req.method === 'GET') {
      return new Response(JSON.stringify({
        name: 'devocional-picgama',
        version: '2.0.0',
        docs: '/docs',
        openapi: '/api-docs',
        health: '/health'
      }), {
        status: 200,
        headers: addCorsHeaders({ 'Content-Type': 'application/json' })
      });
    }

    return new Response(JSON.stringify({ error: 'Not Found' }), {
      status: 404,
      headers: addCorsHeaders({ 'Content-Type': 'application/json' })
    });
  };

  const server = createServer(async (nodeReq: IncomingMessage, nodeRes: ServerResponse) => {
    try {
      const host = nodeReq.headers.host || `localhost:${port}`;
      const fullUrl = `http://${host}${nodeReq.url || '/'}`;
      const pathname = new URL(fullUrl).pathname;
      const contentLength = Number.parseInt(nodeReq.headers['content-length'] || '0', 10) || 0;
      if (isTooLargeAudioUpload(nodeReq.method, pathname, contentLength, audioConfig.maxRequestBytes)) {
        nodeRes.statusCode = 413;
        nodeRes.setHeader('Content-Type', 'application/json');
        nodeRes.setHeader('Connection', 'close');
        for (const [key, value] of Object.entries(addCorsHeaders())) nodeRes.setHeader(key, value);
        nodeRes.end(JSON.stringify({ success: false, error: `Audio file exceeds the ${audioConfig.maxBytes / BYTES_PER_MB} MB limit` }));
        nodeReq.resume();
        return;
      }
      let body: Buffer | undefined;
      if (nodeReq.method !== 'GET' && nodeReq.method !== 'HEAD') {
        body = await new Promise<Buffer>((resolve, reject) => {
          const chunks: Buffer[] = [];
          nodeReq.on('data', (chunk: Buffer) => chunks.push(chunk));
          nodeReq.on('end', () => resolve(Buffer.concat(chunks)));
          nodeReq.on('error', reject);
        });
      }
      const headers = new Headers();
      for (const [key, value] of Object.entries(nodeReq.headers)) {
        if (!value) continue;
        if (Array.isArray(value)) value.forEach((v) => headers.append(key, v));
        else headers.set(key, value);
      }
      const request = new Request(fullUrl, {
        method: nodeReq.method || 'GET',
        headers,
        body: body && body.length > 0 ? body : undefined
      });
      const response = await fetchHandler(request);
      nodeRes.statusCode = response.status;
      response.headers.forEach((value, key) => nodeRes.setHeader(key, value));
      nodeRes.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      logger.error('HTTP handler error', error);
      nodeRes.statusCode = 500;
      nodeRes.setHeader('Content-Type', 'application/json');
      nodeRes.end(JSON.stringify({ error: 'Internal Server Error' }));
    }
  });

  server.listen(port, hostname);
  const localIP = getLocalIP();
  logger.info(`HTTP server listening on http://${hostname}:${port}`);
  if (localIP && hostname === '0.0.0.0') {
    logger.info(`Local network access: http://${localIP}:${port}`);
  }

  void tryInitializeBot().then((initialized) => {
    if (initialized) bot.startScheduler();
  });

  process.on('SIGINT', async () => {
    await bot.close();
    process.exit(0);
  });
  process.on('SIGTERM', async () => {
    await bot.close();
    process.exit(0);
  });
}

if (import.meta.url === `file://${process.argv[1]}` || import.meta.main) {
  void main();
}
