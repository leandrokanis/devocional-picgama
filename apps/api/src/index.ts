import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
import { createServer } from 'http';
import type { IncomingMessage, ServerResponse } from 'http';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { networkInterfaces } from 'os';
import { prisma } from './prisma.js';
import { DevotionalService } from './services/devotional.js';
import { RecipientsService } from './services/recipients.js';
import { SchedulerService } from './services/scheduler.js';
import { UrlShortenerService } from './services/url-shortener.js';
import { WhatsAppService } from './services/whatsapp.js';
import { logger } from './utils/logger.js';

type RecipientPayload = {
  chat_id?: string;
  name?: string;
  type?: string;
};

class DevotionalBot {
  private devotionalService: DevotionalService;
  private whatsappService: WhatsAppService;
  private schedulerService: SchedulerService;
  private isInitialized = false;
  public recipientsService: RecipientsService;
  public currentQRCode: string | null = null;

  constructor() {
    const urlShortener = new UrlShortenerService();
    this.devotionalService = new DevotionalService(process.env.DATA_PATH, urlShortener);
    this.whatsappService = new WhatsAppService({
      sessionName: process.env.WHATSAPP_SESSION_NAME || 'devocional-bot',
      debug: process.env.DEBUG === 'true'
    });
    this.recipientsService = new RecipientsService();
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
    if (!this.devotionalService.validateReadings()) {
      throw new Error('Invalid devotional readings data');
    }
    await this.whatsappService.initialize();
    this.isInitialized = true;
  }

  public async sendTodaysDevotional(): Promise<boolean> {
    try {
      if (!this.isInitialized) await this.initialize();
      const todaysReading = this.devotionalService.getTodaysReading();
      if (!todaysReading) return false;
      const message = await this.devotionalService.formatMessage(todaysReading);
      const recipients = await this.recipientsService.getAll();
      if (!recipients.length) return false;
      let success = 0;
      for (const recipient of recipients) {
        const sent = await this.whatsappService.sendDevotionalMessage(message, recipient.chatId);
        if (sent) success += 1;
      }
      return success > 0;
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
      const todaysReading = this.devotionalService.getTodaysReading();
      if (!todaysReading) return false;
      const message = await this.devotionalService.formatMessage(todaysReading);
      return this.whatsappService.sendDevotionalMessage(message, recipient.chatId);
    } catch (error) {
      logger.error('Error sending devotional to recipient', error);
      return false;
    }
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

  public getTodaysReadingBasic() {
    return this.devotionalService.getTodaysReadingBasic();
  }

  public getAllReadings(dateFilter?: string) {
    return this.devotionalService.getAllReadings(dateFilter);
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

const checkAuth = (req: Request): Response | null => {
  const authToken = process.env.AUTH_TOKEN?.trim();
  if (!authToken) return null;
  const url = new URL(req.url);
  const queryToken = url.searchParams.get('token');
  const authHeader = req.headers.get('Authorization');
  const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  const token = (headerToken || queryToken)?.trim() ?? '';
  if (!token || token !== authToken) {
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

async function main() {
  const bot = new DevotionalBot();
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

    if (url.pathname === '/readings/today' && req.method === 'GET') {
      const reading = bot.getTodaysReadingBasic();
      if (!reading) {
        return new Response(JSON.stringify({ error: 'No devotional reading found for today' }), {
          status: 404,
          headers: addCorsHeaders({ 'Content-Type': 'application/json' })
        });
      }
      return new Response(JSON.stringify(reading), {
        status: 200,
        headers: addCorsHeaders({ 'Content-Type': 'application/json' })
      });
    }

    if (url.pathname === '/readings' && req.method === 'GET') {
      const dateFilter = url.searchParams.get('date');
      const readings = bot.getAllReadings(dateFilter || undefined);
      return new Response(JSON.stringify({
        data: readings,
        metadata: { count: readings.length, ...(dateFilter ? { filteredBy: dateFilter } : {}) }
      }), {
        status: 200,
        headers: addCorsHeaders({ 'Content-Type': 'application/json' })
      });
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
