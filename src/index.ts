import 'dotenv/config';
import { DevotionalService } from './services/devotional.js';
import { WhatsAppService } from './services/whatsapp.js';
import { SchedulerService } from './services/scheduler.js';
import { logger } from './utils/logger.js';

class DevotionalBot {
  private devotionalService: DevotionalService;
  private whatsappService: WhatsAppService;
  private schedulerService: SchedulerService | null = null;
  private isInitialized = false;
  public currentQRCode: string | null = null;

  constructor() {
    this.devotionalService = new DevotionalService(process.env.DATA_PATH);
    
    this.whatsappService = new WhatsAppService({
      sessionName: process.env.WHATSAPP_SESSION_NAME || 'devocional-bot',
      groupChatId: process.env.GROUP_CHAT_ID || '',
      debug: process.env.DEBUG === 'true'
    });

    // Setup QR code callback
    this.whatsappService.onQRCodeGenerated = (base64: string, ascii: string) => {
      this.currentQRCode = this.sanitizeBase64(base64);
      logger.info('🔗 QR Code salvo! Acesse http://localhost:3001/qr para visualizar');
    };

    // Setup scheduler
    const sendTime = process.env.SEND_TIME || '06:00';
    const timezone = process.env.TIMEZONE || 'America/Sao_Paulo';
    
    this.schedulerService = new SchedulerService({
      sendTime,
      timezone,
      onExecute: async () => {
        return await this.sendTodaysDevotional();
      }
    });
  }

  private sanitizeBase64(base64: string): string {
    if (!base64) return '';
    
    let cleaned = base64.trim();
    
    if (cleaned.startsWith('data:')) {
      const commaIndex = cleaned.indexOf(',');
      if (commaIndex !== -1) {
        cleaned = cleaned.substring(commaIndex + 1);
      }
    }
    
    cleaned = cleaned.replace(/\s/g, '');
    cleaned = cleaned.replace(/\n/g, '');
    cleaned = cleaned.replace(/\r/g, '');
    
    return cleaned;
  }

  public async initialize(): Promise<void> {
    try {
      logger.info('🚀 Initializing Devocional Bot...');
      
      if (!process.env.GROUP_CHAT_ID) {
        throw new Error('GROUP_CHAT_ID environment variable is required');
      }

      if (!this.devotionalService.validateReadings()) {
        throw new Error('Invalid devotional readings data');
      }

      logger.info(`📚 Loaded ${this.devotionalService.getReadingsCount()} devotional readings`);

      await this.whatsappService.initialize();
      
      this.isInitialized = true;
      logger.info('✅ Bot initialized successfully');
    } catch (error) {
      logger.error('❌ Error initializing bot', error);
      throw error;
    }
  }

  public async sendTodaysDevotional(): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        logger.info('Bot not initialized, initializing now...');
        try {
          await this.initialize();
        } catch (error) {
          logger.error('❌ Failed to initialize bot', error);
          return false;
        }
      }

      const todaysReading = this.devotionalService.getTodaysReading();
      
      if (!todaysReading) {
        logger.warn('⚠️ No devotional reading found for today');
        return false;
      }

      const message = this.devotionalService.formatMessage(todaysReading);
      logger.info('📖 Sending today\'s devotional:', todaysReading.formattedDate);
      
      const success = await this.whatsappService.sendDevotionalMessage(message);
      
      if (success) {
        logger.info('✅ Devotional message sent successfully');
      } else {
        logger.error('❌ Failed to send devotional message');
      }

      return success;
    } catch (error) {
      logger.error('❌ Error sending devotional', error);
      return false;
    }
  }


  public async testConnection(): Promise<void> {
    try {
      await this.initialize();
      
      const isConnected = await this.whatsappService.checkConnection();
      if (!isConnected) {
        throw new Error('WhatsApp client is not connected');
      }
      
      logger.info('📱 WhatsApp connection verified');
      
      const testMessage = '🤖 Bot de teste - conexão estabelecida com sucesso!';
      const success = await this.whatsappService.sendMessage(testMessage);
      
      if (success) {
        logger.info('✅ Test message sent successfully');
      } else {
        logger.error('❌ Failed to send test message');
      }
    } catch (error) {
      logger.error('❌ Connection test failed', error);
    }
  }

  public async close(): Promise<void> {
    logger.info('🔄 Closing bot...');
    if (this.schedulerService) {
      this.schedulerService.stop();
    }
    await this.whatsappService.close();
    logger.info('👋 Bot closed');
  }

  public getConnectionStatus(): boolean {
    return this.isInitialized && this.whatsappService.getConnectionStatus();
  }

  public getAllReadings(dateFilter?: string) {
    return this.devotionalService.getAllReadings(dateFilter);
  }

  public getTodaysReading() {
    return this.devotionalService.getTodaysReading();
  }

  public getTodaysReadingBasic() {
    return this.devotionalService.getTodaysReadingBasic();
  }

  public getSchedulerStatus() {
    return this.schedulerService?.getStatus() || { running: false };
  }

  public startScheduler(): void {
    if (this.schedulerService) {
      this.schedulerService.start();
    }
  }

  public stopScheduler(): void {
    if (this.schedulerService) {
      this.schedulerService.stop();
    }
  }


  public async forceWhatsAppReconnect(): Promise<boolean> {
    try {
      logger.info('🔄 Forcing WhatsApp reconnection...');
      
      // Reset initialization flag
      this.isInitialized = false;
      this.currentQRCode = null;
      
      // Force reconnection
      await this.whatsappService.forceReconnect();
      
      // Update initialization status
      this.isInitialized = true;
      
      logger.info('✅ WhatsApp reconnection completed');
      return true;
    } catch (error) {
      logger.error('❌ Failed to force WhatsApp reconnection', error);
      this.isInitialized = false;
      return false;
    }
  }
}

// Memory monitoring and GC
const setupMemoryMonitoring = () => {
  const GC_INTERVAL = 60000; // 1 minute
  
  setInterval(() => {
    // Force GC
    Bun.gc(true);
    
    // Log memory usage
    const used = process.memoryUsage();
    // Only log if debug is enabled or memory is high (> 400MB)
    const isHighMemory = used.rss > 400 * 1024 * 1024;
    
    if (process.env.DEBUG === 'true' || isHighMemory) {
      if (isHighMemory) {
        logger.warn('🧠 Memory usage:', {
          rss: `${Math.round(used.rss / 1024 / 1024 * 100) / 100} MB`,
          heapTotal: `${Math.round(used.heapTotal / 1024 / 1024 * 100) / 100} MB`,
          heapUsed: `${Math.round(used.heapUsed / 1024 / 1024 * 100) / 100} MB`,
          external: `${Math.round(used.external / 1024 / 1024 * 100) / 100} MB`,
        });
      } else {
        logger.debug('🧠 Memory usage:', {
          rss: `${Math.round(used.rss / 1024 / 1024 * 100) / 100} MB`,
          heapTotal: `${Math.round(used.heapTotal / 1024 / 1024 * 100) / 100} MB`,
          heapUsed: `${Math.round(used.heapUsed / 1024 / 1024 * 100) / 100} MB`,
          external: `${Math.round(used.external / 1024 / 1024 * 100) / 100} MB`,
        });
      }
    }
  }, GC_INTERVAL);
  
  logger.info('🧠 Memory monitoring and periodic GC enabled');
};

async function main() {
  const bot = new DevotionalBot();

  const command = process.argv[2];

  try {
    switch (command) {
      case 'test':
        await bot.testConnection();
        await bot.close();
        break;
      case 'send':
        let url: string;
        
        if (process.env.SERVER_URL) {
          // Remove trailing slash if present
          const baseUrl = process.env.SERVER_URL.replace(/\/$/, '');
          url = `${baseUrl}/send`;
        } else {
          const serverPort = process.env.PORT || process.env.SERVER_PORT || '3000';
          const serverHost = process.env.SERVER_HOST || 'localhost';
          url = `http://${serverHost}:${serverPort}/send`;
        }
        
        try {
          logger.info(`📡 Sending request to running instance: ${url}`);
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            }
          });

          if (!response.ok) {
            const errorText = await response.text();
            logger.error(`❌ Server responded with error: ${response.status} - ${errorText}`);
            process.exit(1);
          }

          const result = await response.json() as { success: boolean; error?: string; message?: string };
          if (result.success) {
            logger.info('✅ Devotional message sent successfully');
            process.exit(0);
          } else {
            logger.error(`❌ Failed to send devotional: ${result.error || 'Unknown error'}`);
            process.exit(1);
          }
        } catch (error) {
          logger.error('❌ Failed to connect to running instance. Make sure the bot is running with "bun run dev" or "bun run start"', error);
          process.exit(1);
        }
        break;
      case 'start':
      default:
        const port = parseInt(process.env.PORT || process.env.SERVER_PORT || '3000', 10);
        const hostname = process.env.SERVER_HOST || '0.0.0.0';
        
        // Setup memory monitoring
        setupMemoryMonitoring();
        
        let botInitialized = false;
        
        const tryInitializeBot = async () => {
          if (botInitialized) return true;
          try {
            await bot.initialize();
            botInitialized = true;
            return true;
          } catch (error) {
            logger.warn('⚠️ Bot initialization failed, but server will continue running', error);
            return false;
          }
        };
        
        // CORS headers function
        const addCorsHeaders = (headers: Record<string, string> = {}) => {
          return {
            ...headers,
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400'
          };
        };

        // Function to get local IP address
        const getLocalIP = () => {
          try {
            const { networkInterfaces } = require('os');
            const nets = networkInterfaces();
            
            for (const name of Object.keys(nets)) {
              for (const net of nets[name]) {
                // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
                if (net.family === 'IPv4' && !net.internal) {
                  return net.address;
                }
              }
            }
          } catch (error) {
            logger.debug('Could not determine local IP address', error);
          }
          return null;
        };

        const checkAuth = (req: Request): Response | null => {
          const authToken = process.env.AUTH_TOKEN;
          const url = new URL(req.url);
          const queryToken = url.searchParams.get('token');
          const authHeader = req.headers.get('Authorization');
          
          if (authToken) {
            const headerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
            const token = headerToken || queryToken;

            if (!token || token !== authToken) {
              logger.warn('⚠️ Unauthorized access attempt');
              return new Response(JSON.stringify({ 
                success: false, 
                error: 'Unauthorized' 
              }), {
                status: 401,
                headers: addCorsHeaders({ 'Content-Type': 'application/json' })
              });
            }
          } else {
            logger.warn('⚠️ AUTH_TOKEN not set, endpoint is unprotected');
          }
          
          return null;
        };

        const checkBasicAuth = (req: Request): Response | null => {
          const user = process.env.CONFIG_USER;
          const pass = process.env.CONFIG_PASSWORD;

          if (!user || !pass) {
            return new Response('Setup required: CONFIG_USER and CONFIG_PASSWORD env vars not set', { 
              status: 500,
              headers: addCorsHeaders({ 'Content-Type': 'text/plain' })
            });
          }

          const authHeader = req.headers.get('Authorization');
          
          if (!authHeader || !authHeader.startsWith('Basic ')) {
            return new Response('Unauthorized', {
              status: 401,
              headers: addCorsHeaders({
                'WWW-Authenticate': 'Basic realm="Devocional Bot Admin"',
                'Content-Type': 'text/plain'
              })
            });
          }

          try {
            const parts = authHeader.split(' ');
            if (parts.length < 2) throw new Error('Invalid header format');
            
            const base64Credentials = parts[1];
            if (!base64Credentials) throw new Error('Invalid credentials format');
            
            const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
            const [username, password] = credentials.split(':');

            if (username === user && password === pass) {
              return null;
            }
          } catch (e) {
            // ignore error
          }

          return new Response('Invalid credentials', {
            status: 401,
            headers: addCorsHeaders({
              'WWW-Authenticate': 'Basic realm="Devocional Bot Admin"',
              'Content-Type': 'text/plain'
            })
          });
        };

        Bun.serve({
          port,
          hostname,
          async fetch(req) {
            const url = new URL(req.url);
            const isDevelopment = process.env.NODE_ENV !== 'production';
            
            logger.debug(`📥 ${req.method} ${url.pathname}${url.search}`);
            
            // Handle preflight OPTIONS requests
            if (req.method === 'OPTIONS') {
              return new Response(null, {
                status: 200,
                headers: addCorsHeaders()
              });
            }
            

            if (url.pathname === '/send' && req.method === 'POST') {
              try {
                const authError = checkAuth(req);
                if (authError) return authError;

                logger.info('📨 Received send request via HTTP');
                
                if (!process.env.GROUP_CHAT_ID) {
                  return new Response(JSON.stringify({ 
                    success: false, 
                    error: 'GROUP_CHAT_ID environment variable is required' 
                  }), {
                    status: 400,
                    headers: addCorsHeaders({ 'Content-Type': 'application/json' })
                  });
                }
                
                const success = await bot.sendTodaysDevotional();
                
                if (success) {
                  return new Response(JSON.stringify({ 
                    success: true, 
                    message: 'Devotional sent successfully' 
                  }), {
                    status: 200,
                    headers: addCorsHeaders({ 'Content-Type': 'application/json' })
                  });
                } else {
                  return new Response(JSON.stringify({ 
                    success: false, 
                    error: 'Failed to send devotional' 
                  }), {
                    status: 500,
                    headers: addCorsHeaders({ 'Content-Type': 'application/json' })
                  });
                }
              } catch (error) {
                logger.error('❌ Error handling send request', error);
                return new Response(JSON.stringify({ 
                  success: false, 
                  error: error instanceof Error ? error.message : 'Unknown error' 
                }), {
                  status: 500,
                  headers: addCorsHeaders({ 'Content-Type': 'application/json' })
                });
              }
            }
            
            if (url.pathname === '/health' && req.method === 'GET') {
              const isConnected = bot.getConnectionStatus();
              const schedulerStatus = bot.getSchedulerStatus();
              return new Response(JSON.stringify({ 
                status: 'ok', 
                connected: isConnected,
                hasQRCode: bot.currentQRCode !== null,
                scheduler: schedulerStatus
              }), {
                status: 200,
                headers: addCorsHeaders({ 'Content-Type': 'application/json' })
              });
            }
            
            if (url.pathname === '/qr/image' && req.method === 'GET') {
              const authError = checkAuth(req);
              if (authError) return authError;
              
              if (!bot.currentQRCode) {
                return new Response('QR code não disponível', {
                  status: 404,
                  headers: addCorsHeaders({ 'Content-Type': 'text/plain' })
                });
              }
              
              try {
                const base64Data = bot.currentQRCode;
                const imageBuffer = Buffer.from(base64Data, 'base64');
                
                return new Response(imageBuffer, {
                  status: 200,
                  headers: addCorsHeaders({ 
                    'Content-Type': 'image/png',
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                  })
                });
              } catch (error) {
                logger.error('Erro ao gerar imagem do QR code:', error);
                return new Response('Erro ao processar QR code', {
                  status: 500,
                  headers: addCorsHeaders({ 'Content-Type': 'text/plain' })
                });
              }
            }
            
            if (url.pathname === '/qr' && req.method === 'GET') {
              const authError = checkAuth(req);
              if (authError) return authError;
              
              const forceReconnect = url.searchParams.get('reconnect') === 'true';
              const token = url.searchParams.get('token');
              const tokenAmp = token ? `&token=${token}` : '';
              const tokenQm = token ? `?token=${token}` : '';
              
              // If force reconnect is requested, try to reconnect
              if (forceReconnect) {
                try {
                  logger.info('🔄 Force reconnect requested via /qr?reconnect=true');
                  await bot.forceWhatsAppReconnect();
                  
                  // Wait a bit for QR code generation
                  await new Promise(resolve => setTimeout(resolve, 2000));
                } catch (error) {
                  logger.error('❌ Error during force reconnect', error);
                }
              }
              
              if (!bot.currentQRCode) {
                const isConnected = bot.getConnectionStatus();
                const reconnectButton = `
                  <div style="margin-top: 20px;">
                    <button class="refresh-btn" onclick="window.location.href='/qr?reconnect=true${tokenAmp}'">
                      🔄 Forçar Nova Autenticação
                    </button>
                  </div>`;
                
                const statusMessage = isConnected 
                  ? 'WhatsApp já está conectado! Se você está tendo problemas, pode forçar uma nova autenticação.' 
                  : 'Nenhum QR code disponível no momento. Clique no botão abaixo para tentar uma nova autenticação.';
                
                const noQrHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WhatsApp QR Code - Devocional Bot</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 600px;
      margin: 50px auto;
      padding: 20px;
      text-align: center;
      background: #f5f5f5;
    }
    .container {
      background: white;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .refresh-btn {
      margin-top: 20px;
      padding: 12px 24px;
      background: #25D366;
      color: white;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-size: 16px;
      text-decoration: none;
      display: inline-block;
    }
    .refresh-btn:hover {
      background: #128C7E;
    }
    .status {
      padding: 15px;
      margin: 20px 0;
      border-radius: 5px;
      background: ${isConnected ? '#d4edda' : '#f8d7da'};
      color: ${isConnected ? '#155724' : '#721c24'};
      border: 1px solid ${isConnected ? '#c3e6cb' : '#f5c6cb'};
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📱 WhatsApp QR Code</h1>
    
    <div class="status">
      <strong>Status:</strong> ${isConnected ? '✅ Conectado' : '❌ Desconectado'}
    </div>
    
    <p>${statusMessage}</p>
    ${reconnectButton}
    
    <div style="margin-top: 30px; font-size: 14px; color: #666;">
      <p>💡 <strong>Dica:</strong> Se o WhatsApp não conectar após escanear o QR code, tente:</p>
      <ul style="text-align: left; display: inline-block;">
        <li>Verificar se o WhatsApp Web não está aberto em outro navegador</li>
        <li>Desconectar outros dispositivos no WhatsApp</li>
        <li>Forçar uma nova autenticação usando o botão acima</li>
      </ul>
    </div>
  </div>
</body>
</html>`;
                
                return new Response(noQrHtml, {
                  status: 200,
                  headers: addCorsHeaders({ 'Content-Type': 'text/html; charset=utf-8' })
                });
              }
              
              const qrHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WhatsApp QR Code - Devocional Bot</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 600px;
      margin: 50px auto;
      padding: 20px;
      text-align: center;
      background: #f5f5f5;
    }
    .container {
      background: white;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .qr-code {
      margin: 20px 0;
      padding: 20px;
      background: white;
      border: 2px solid #ddd;
      border-radius: 8px;
      display: inline-block;
    }
    .instructions {
      margin-top: 20px;
      color: #666;
      line-height: 1.6;
    }
    .btn {
      margin: 10px 5px;
      padding: 12px 20px;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-size: 16px;
      text-decoration: none;
      display: inline-block;
    }
    .btn-primary {
      background: #25D366;
      color: white;
    }
    .btn-primary:hover {
      background: #128C7E;
    }
    .btn-secondary {
      background: #6c757d;
      color: white;
    }
    .btn-secondary:hover {
      background: #545b62;
    }
    .status-indicator {
      display: inline-block;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #28a745;
      margin-right: 8px;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0% { opacity: 1; }
      50% { opacity: 0.5; }
      100% { opacity: 1; }
    }
    .timer {
      margin-top: 15px;
      font-size: 14px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📱 WhatsApp QR Code</h1>
    <p><span class="status-indicator"></span>QR Code ativo - Escaneie com seu WhatsApp:</p>
    
    <div class="qr-code">
      <img id="qrImage" src="/qr/image${tokenQm}" alt="WhatsApp QR Code" style="max-width: 300px; display: block; margin: 0 auto;" onerror="this.src='/qr/image?t=' + Date.now() + '${tokenAmp}';">
    </div>
    
    <div class="instructions">
      <h3>Como conectar:</h3>
      <ol style="text-align: left; display: inline-block;">
        <li>Abra o WhatsApp no seu celular</li>
        <li>Toque em <strong>Menu</strong> (três pontos) ou <strong>Configurações</strong></li>
        <li>Toque em <strong>Aparelhos conectados</strong></li>
        <li>Toque em <strong>Conectar um aparelho</strong></li>
        <li>Aponte a câmera para este QR code</li>
      </ol>
    </div>
    
    <div>
      <button class="btn btn-primary" onclick="window.location.reload()">🔄 Atualizar QR Code</button>
      <button class="btn btn-secondary" onclick="window.location.href='/qr?reconnect=true${tokenAmp}'">🔄 Nova Autenticação</button>
    </div>
    
    <div class="timer">
      <p>⏱️ Página será atualizada automaticamente em <span id="countdown">15</span> segundos</p>
    </div>
    
    <div style="margin-top: 30px; font-size: 14px; color: #666;">
      <p>💡 <strong>Problemas para conectar?</strong></p>
      <ul style="text-align: left; display: inline-block;">
        <li>Verifique se o WhatsApp Web não está aberto em outro navegador</li>
        <li>Desconecte outros dispositivos no WhatsApp (máximo 4 dispositivos)</li>
        <li>Se o QR code expirar, clique em "Nova Autenticação"</li>
      </ul>
    </div>
  </div>
  
  <script>
    let countdown = 15;
    const countdownElement = document.getElementById('countdown');
    const qrImage = document.getElementById('qrImage');
    
    const refreshQRImage = () => {
      if (qrImage) {
        qrImage.src = '/qr/image?t=' + Date.now() + '${tokenAmp}';
      }
    };
    
    refreshQRImage();
    setInterval(refreshQRImage, 5000);
    
    const timer = setInterval(() => {
      countdown--;
      countdownElement.textContent = countdown;
      
      if (countdown <= 0) {
        window.location.reload();
      }
    }, 1000);
    
    const checkStatus = async () => {
      try {
        const response = await fetch('/health');
        const data = await response.json();
        
        if (data.connected) {
          clearInterval(timer);
          document.body.innerHTML = \`
            <div class="container">
              <h1>✅ WhatsApp Conectado!</h1>
              <p>A autenticação foi realizada com sucesso.</p>
              <p>O bot está pronto para enviar mensagens.</p>
              <button class="btn btn-primary" onclick="window.location.href='/'">🏠 Voltar ao Início</button>
            </div>
          \`;
        }
      } catch (error) {
        console.log('Erro ao verificar status:', error);
      }
    };
    
    setInterval(checkStatus, 3000);
  </script>
</body>
</html>`;
              
              return new Response(qrHtml, {
                status: 200,
                headers: addCorsHeaders({ 'Content-Type': 'text/html; charset=utf-8' })
              });
            }

            if (url.pathname === '/config' && req.method === 'GET') {
              const authError = checkBasicAuth(req);
              if (authError) return authError;
              
              const authToken = process.env.AUTH_TOKEN || '';

              const configHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Painel Administrativo - Devocional Bot</title>
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
  <style>
    :root {
      --primary-color: #25D366;
      --secondary-color: #128C7E;
      --bg-color: #f0f2f5;
      --card-bg: #ffffff;
      --text-color: #1c1e21;
      --danger-color: #dc3545;
      --success-color: #28a745;
      --warning-color: #ffc107;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 20px;
      background-color: var(--bg-color);
      color: var(--text-color);
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 30px;
      background: var(--card-bg);
      padding: 20px;
      border-radius: 10px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.05);
    }

    .header h1 {
      margin: 0;
      color: var(--secondary-color);
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
    }

    .card {
      background: var(--card-bg);
      padding: 25px;
      border-radius: 10px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.05);
      transition: transform 0.2s;
    }

    .card:hover {
      transform: translateY(-2px);
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      border-bottom: 1px solid #eee;
      padding-bottom: 10px;
    }

    .card-title {
      font-size: 1.2em;
      font-weight: bold;
      color: var(--secondary-color);
      margin: 0;
    }

    .status-badge {
      padding: 5px 10px;
      border-radius: 20px;
      font-size: 0.9em;
      font-weight: bold;
    }

    .status-online {
      background-color: #d4edda;
      color: var(--success-color);
    }

    .status-offline {
      background-color: #f8d7da;
      color: var(--danger-color);
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 20px;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-size: 1em;
      transition: background 0.3s;
      text-decoration: none;
      color: white;
      width: 100%;
      justify-content: center;
      box-sizing: border-box;
      margin-bottom: 10px;
    }

    .btn-primary { background-color: var(--primary-color); }
    .btn-primary:hover { background-color: var(--secondary-color); }
    
    .btn-danger { background-color: var(--danger-color); }
    .btn-danger:hover { background-color: #c82333; }

    .btn-outline {
      background-color: transparent;
      border: 2px solid var(--secondary-color);
      color: var(--secondary-color);
    }
    .btn-outline:hover {
      background-color: var(--secondary-color);
      color: white;
    }

    .info-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
      padding-bottom: 5px;
      border-bottom: 1px dashed #eee;
    }

    .info-label { color: #666; }
    .info-value { font-weight: 500; }

    #qr-preview {
      text-align: center;
      margin: 15px 0;
      min-height: 150px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f9f9f9;
      border-radius: 5px;
    }

    .hidden { display: none; }

    .loading {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      100% { transform: rotate(360deg); }
    }
    
    .toast {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #333;
      color: white;
      padding: 15px 25px;
      border-radius: 5px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 1000;
      display: none;
      animation: slideIn 0.3s ease-out;
    }

    @keyframes slideIn {
      from { transform: translateY(100%); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1><i class="fab fa-whatsapp"></i> Painel Administrativo</h1>
      <div id="connection-status" class="status-badge">Verificando...</div>
    </div>

    <div class="grid">
      <!-- Status & Connections -->
      <div class="card">
        <div class="card-header">
          <h2 class="card-title"><i class="fas fa-network-wired"></i> Conexão</h2>
        </div>
        <div class="card-content">
          <div class="info-row">
            <span class="info-label">Status WhatsApp:</span>
            <span id="wa-status" class="info-value">...</span>
          </div>
          <div class="info-row">
            <span class="info-label">Servidor:</span>
            <span class="info-value status-online">Online</span>
          </div>
          
          <div id="qr-section" class="hidden">
            <div id="qr-preview">
              <i class="fas fa-qrcode fa-3x" style="color: #ccc;"></i>
            </div>
            <a href="/qr${authToken ? '?token=' + authToken : ''}" class="btn btn-primary" target="_blank">
              <i class="fas fa-expand"></i> Abrir QR Code
            </a>
          </div>

          <div id="connected-actions" class="hidden">
            <button onclick="reconnect()" class="btn btn-outline">
              <i class="fas fa-sync"></i> Reiniciar Conexão
            </button>
          </div>
        </div>
      </div>

      <!-- Today's Devotional -->
      <div class="card">
        <div class="card-header">
          <h2 class="card-title"><i class="fas fa-book-bible"></i> Devocional de Hoje</h2>
        </div>
        <div class="card-content">
          <div id="devotional-preview">
            <div class="info-row">
              <span class="info-label">Data:</span>
              <span id="dev-date" class="info-value">...</span>
            </div>
            <div class="info-row">
              <span class="info-label">Leitura:</span>
              <span id="dev-reading" class="info-value">...</span>
            </div>
          </div>
          <button onclick="sendDevotional()" class="btn btn-primary" style="margin-top: 15px;">
            <i class="fas fa-paper-plane"></i> Enviar Agora
          </button>
          <a href="/readings/today" target="_blank" class="btn btn-outline">
            <i class="fas fa-eye"></i> Ver JSON
          </a>
        </div>
      </div>

      <!-- Quick Actions & Links -->
      <div class="card">
        <div class="card-header">
          <h2 class="card-title"><i class="fas fa-link"></i> Links Úteis</h2>
        </div>
        <div class="card-content">
          <a href="/docs" target="_blank" class="btn btn-outline">
            <i class="fas fa-file-code"></i> Documentação Swagger
          </a>
          <a href="/readings" target="_blank" class="btn btn-outline">
            <i class="fas fa-list"></i> Ver Todas as Leituras
          </a>
          <a href="/health" target="_blank" class="btn btn-outline">
            <i class="fas fa-heartbeat"></i> Health Check
          </a>
        </div>
      </div>
    </div>
  </div>

  <div id="toast" class="toast"></div>

  <script>
    // Configuration
    const REFRESH_INTERVAL = 5000;
    const AUTH_TOKEN = '${authToken}';

    // Utils
    function showToast(message, type = 'info') {
      const toast = document.getElementById('toast');
      toast.textContent = message;
      toast.style.backgroundColor = type === 'error' ? 'var(--danger-color)' : '#333';
      toast.style.display = 'block';
      setTimeout(() => { toast.style.display = 'none'; }, 3000);
    }

    async function fetchData(endpoint) {
      try {
        const headers = {};
        if (AUTH_TOKEN) {
          headers['Authorization'] = 'Bearer ' + AUTH_TOKEN;
        }
        const res = await fetch(endpoint, { headers });
        return await res.json();
      } catch (e) {
        console.error('Error fetching ' + endpoint + ':', e);
        return null;
      }
    }

    async function loadQrImage(container) {
      try {
        const headers = {};
        if (AUTH_TOKEN) {
          headers['Authorization'] = 'Bearer ' + AUTH_TOKEN;
        }
        const res = await fetch('/qr/image', { headers });
        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          container.innerHTML = \`<img src="\${url}" style="max-width: 100%; max-height: 150px;" onload="URL.revokeObjectURL(this.src)">\`;
        } else {
          container.innerHTML = '<p>Erro ao carregar QR Code</p>';
        }
      } catch (e) {
        console.error('Error loading QR image:', e);
        container.innerHTML = '<p>Erro ao carregar QR Code</p>';
      }
    }

    // Actions
    async function sendDevotional() {
      if (!confirm('Tem certeza que deseja enviar o devocional agora?')) return;
      
      const btn = document.querySelector('button[onclick="sendDevotional()"]');
      const originalText = btn.innerHTML;
      btn.innerHTML = '<i class="fas fa-spinner loading"></i> Enviando...';
      btn.disabled = true;

      try {
        const headers = {};
        if (AUTH_TOKEN) {
          headers['Authorization'] = 'Bearer ' + AUTH_TOKEN;
        }

        const res = await fetch('/send', { 
          method: 'POST',
          headers
        });
        const data = await res.json();
        
        if (data.success) {
          showToast('✅ Devocional enviado com sucesso!');
        } else {
          showToast('❌ Erro: ' + (data.error || 'Falha ao enviar'), 'error');
        }
      } catch (e) {
        showToast('❌ Erro de conexão', 'error');
      } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
      }
    }

    async function reconnect() {
      if (!confirm('Isso irá desconectar a sessão atual. Continuar?')) return;
      window.location.href = '/qr?reconnect=true' + (AUTH_TOKEN ? '&token=' + AUTH_TOKEN : '');
    }

    // Updates
    async function updateStatus() {
      const health = await fetchData('/health');
      const statusBadge = document.getElementById('connection-status');
      const waStatus = document.getElementById('wa-status');
      const qrSection = document.getElementById('qr-section');
      const connectedActions = document.getElementById('connected-actions');
      const qrPreview = document.getElementById('qr-preview');

      if (health && health.connected) {
        statusBadge.textContent = 'Conectado';
        statusBadge.className = 'status-badge status-online';
        waStatus.textContent = '🟢 Online';
        qrSection.classList.add('hidden');
        connectedActions.classList.remove('hidden');
      } else {
        statusBadge.textContent = 'Desconectado';
        statusBadge.className = 'status-badge status-offline';
        waStatus.textContent = '🔴 Offline';
        qrSection.classList.remove('hidden');
        connectedActions.classList.add('hidden');
        
        // Show QR Preview if available
        if (health && health.hasQRCode) {
           loadQrImage(qrPreview);
        } else {
           qrPreview.innerHTML = '<p>Aguardando QR Code...</p>';
        }
      }
    }

    async function updateReading() {
      const reading = await fetchData('/readings/today');
      if (reading) {
        document.getElementById('dev-date').textContent = reading.formattedDate || reading.date;
        document.getElementById('dev-reading').textContent = reading.reading;
      } else {
        document.getElementById('dev-reading').textContent = 'Não encontrada';
      }
    }

    // Initialize
    document.addEventListener('DOMContentLoaded', () => {
      updateStatus();
      updateReading();
      setInterval(updateStatus, REFRESH_INTERVAL);
    });
  </script>
</body>
</html>`;

              return new Response(configHtml, {
                status: 200,
                headers: addCorsHeaders({ 'Content-Type': 'text/html; charset=utf-8' })
              });
            }
            
            if (url.pathname === '/readings/today' && req.method === 'GET') {
              try {
                logger.info('📖 Received request for today\'s reading');
                const todaysReading = bot.getTodaysReadingBasic();
                
                if (!todaysReading) {
                  return new Response(JSON.stringify({ 
                    error: 'No devotional reading found for today'
                  }), {
                    status: 404,
                    headers: addCorsHeaders({ 'Content-Type': 'application/json' })
                  });
                }
                
                return new Response(JSON.stringify(todaysReading), {
                  status: 200,
                  headers: { 'Content-Type': 'application/json' }
                });
              } catch (error) {
                logger.error('❌ Error getting today\'s reading', error);
                return new Response(JSON.stringify({ 
                  error: error instanceof Error ? error.message : 'Failed to get today\'s reading' 
                }), {
                  status: 500,
                  headers: { 'Content-Type': 'application/json' }
                });
              }
            }
            
            if (url.pathname === '/scheduler/status' && req.method === 'GET') {
              try {
                const schedulerStatus = bot.getSchedulerStatus();
                return new Response(JSON.stringify(schedulerStatus), {
                  status: 200,
                  headers: addCorsHeaders({ 'Content-Type': 'application/json' })
                });
              } catch (error) {
                logger.error('❌ Error getting scheduler status', error);
                return new Response(JSON.stringify({ 
                  error: error instanceof Error ? error.message : 'Failed to get scheduler status' 
                }), {
                  status: 500,
                  headers: addCorsHeaders({ 'Content-Type': 'application/json' })
                });
              }
            }
            
            if (url.pathname === '/scheduler/start' && req.method === 'POST') {
              try {
                const authError = checkAuth(req);
                if (authError) return authError;

                bot.startScheduler();
                logger.info('📅 Scheduler started via API');
                return new Response(JSON.stringify({ 
                  success: true, 
                  message: 'Scheduler started successfully' 
                }), {
                  status: 200,
                  headers: addCorsHeaders({ 'Content-Type': 'application/json' })
                });
              } catch (error) {
                logger.error('❌ Error starting scheduler', error);
                return new Response(JSON.stringify({ 
                  success: false, 
                  error: error instanceof Error ? error.message : 'Failed to start scheduler' 
                }), {
                  status: 500,
                  headers: addCorsHeaders({ 'Content-Type': 'application/json' })
                });
              }
            }
            
            if (url.pathname === '/scheduler/stop' && req.method === 'POST') {
              try {
                const authError = checkAuth(req);
                if (authError) return authError;

                bot.stopScheduler();
                logger.info('📅 Scheduler stopped via API');
                return new Response(JSON.stringify({ 
                  success: true, 
                  message: 'Scheduler stopped successfully' 
                }), {
                  status: 200,
                  headers: addCorsHeaders({ 'Content-Type': 'application/json' })
                });
              } catch (error) {
                logger.error('❌ Error stopping scheduler', error);
                return new Response(JSON.stringify({ 
                  success: false, 
                  error: error instanceof Error ? error.message : 'Failed to stop scheduler' 
                }), {
                  status: 500,
                  headers: addCorsHeaders({ 'Content-Type': 'application/json' })
                });
              }
            }
            
            if (url.pathname === '/readings' && req.method === 'GET') {
              try {
                logger.info('📖 Received request for readings');
                const dateFilter = url.searchParams.get('date');
                const hasDateFilter = dateFilter !== null && dateFilter.trim() !== '';
                const readings = bot.getAllReadings(hasDateFilter ? dateFilter : undefined);
                logger.info(`📚 Returning ${readings.length} readings`);
                return new Response(JSON.stringify({ 
                  data: readings,
                  metadata: {
                    count: readings.length,
                    ...(hasDateFilter && { filteredBy: dateFilter })
                  }
                }), {
                  status: 200,
                  headers: { 'Content-Type': 'application/json' }
                });
              } catch (error) {
                logger.error('❌ Error getting readings', error);
                return new Response(JSON.stringify({ 
                  error: error instanceof Error ? error.message : 'Failed to get readings' 
                }), {
                  status: 500,
                  headers: { 'Content-Type': 'application/json' }
                });
              }
            }
            
            if (url.pathname === '/api-docs' && req.method === 'GET') {
              if (!isDevelopment) {
                return new Response('Not Found', { status: 404 });
              }
              
              try {
                const swaggerPaths = [
                  './src/swagger.json',
                  './dist/swagger.json',
                  new URL('./swagger.json', import.meta.url).pathname
                ];
                
                let swaggerData = null;
                for (const path of swaggerPaths) {
                  try {
                    const file = Bun.file(path);
                    if (await file.exists()) {
                      swaggerData = await file.json();
                      break;
                    }
                  } catch {
                    continue;
                  }
                }
                
                if (!swaggerData) {
                  throw new Error('Swagger spec file not found');
                }
                
                // Get the request host to determine the correct server URL
                const requestHost = req.headers.get('host') || `${hostname}:${port}`;
                const protocol = req.headers.get('x-forwarded-proto') || 'http';
                const localIP = getLocalIP();
                
                // Create multiple server options for flexibility
                const servers = [];
                
                // Add the current request host (highest priority)
                servers.push({
                  url: `${protocol}://${requestHost}`,
                  description: 'Servidor atual (detectado automaticamente)'
                });
                
                // Add local network IP if available and different from request host
                if (localIP && !requestHost.includes(localIP)) {
                  servers.push({
                    url: `http://${localIP}:${port}`,
                    description: `Servidor na rede local (${localIP})`
                  });
                }
                
                // Add localhost if different from request host
                if (!requestHost.includes('localhost') && !requestHost.includes('127.0.0.1')) {
                  servers.push({
                    url: `http://localhost:${port}`,
                    description: 'Servidor local (localhost)'
                  });
                }
                
                // Add 0.0.0.0 if hostname is set to that and useful for documentation
                if (hostname === '0.0.0.0') {
                  servers.push({
                    url: `http://0.0.0.0:${port}`,
                    description: 'Servidor em todas as interfaces (0.0.0.0)'
                  });
                }

                const spec = {
                  ...swaggerData,
                  servers
                };
                return new Response(JSON.stringify(spec), {
                  status: 200,
                  headers: { 'Content-Type': 'application/json' }
                });
              } catch (error) {
                logger.error('❌ Error loading swagger spec', error);
                return new Response(JSON.stringify({ error: 'Failed to load API documentation' }), {
                  status: 500,
                  headers: { 'Content-Type': 'application/json' }
                });
              }
            }
            
            if (url.pathname === '/docs') {
              if (!isDevelopment) {
                return new Response('Not Found', { status: 404 });
              }
              
              const swaggerHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Devocional Bot API - Swagger</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.10.5/swagger-ui.css" />
  <style>
    html {
      box-sizing: border-box;
      overflow: -moz-scrollbars-vertical;
      overflow-y: scroll;
    }
    *, *:before, *:after {
      box-sizing: inherit;
    }
    body {
      margin:0;
      background: #fafafa;
    }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.10.5/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5.10.5/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      const ui = SwaggerUIBundle({
        url: '/api-docs',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout",
        validatorUrl: null
      });
    };
  </script>
</body>
</html>`;
              return new Response(swaggerHtml, {
                status: 200,
                headers: addCorsHeaders({ 'Content-Type': 'text/html; charset=utf-8' })
              });
            }
            
            if (url.pathname === '/' && req.method === 'GET') {
              const swaggerLinks = isDevelopment ? `
    <div class="links">
      <a href="/config" style="background-color: #25D366;">⚙️ Painel Administrativo</a>
      <a href="/docs">📚 Documentação Swagger</a>
      <a href="/api-docs">📄 OpenAPI Spec (JSON)</a>
    </div>` : `
    <div class="links">
      <a href="/config" style="background-color: #25D366;">⚙️ Painel Administrativo</a>
    </div>`;
              
              const swaggerEndpoints = isDevelopment ? `
    <div class="endpoint">
      <span class="method get">GET</span>
      <strong>/docs</strong>
      <p>Interface Swagger UI para explorar e testar a API.</p>
    </div>
    
    <div class="endpoint">
      <span class="method get">GET</span>
      <strong>/api-docs</strong>
      <p>Especificação OpenAPI em formato JSON.</p>
    </div>` : '';
              
              return new Response(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Devocional Bot API</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      max-width: 800px;
      margin: 50px auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .container {
      background: white;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    h1 {
      color: #333;
      margin-top: 0;
    }
    .links {
      margin-top: 30px;
    }
    .links a {
      display: inline-block;
      margin-right: 20px;
      padding: 10px 20px;
      background: #4CAF50;
      color: white;
      text-decoration: none;
      border-radius: 4px;
      transition: background 0.3s;
    }
    .links a:hover {
      background: #45a049;
    }
    .endpoint {
      margin: 20px 0;
      padding: 15px;
      background: #f9f9f9;
      border-left: 4px solid #4CAF50;
      border-radius: 4px;
    }
    .method {
      display: inline-block;
      padding: 4px 8px;
      background: #4CAF50;
      color: white;
      border-radius: 3px;
      font-weight: bold;
      font-size: 12px;
      margin-right: 10px;
    }
    .method.get {
      background: #2196F3;
    }
    code {
      background: #f4f4f4;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
      font-size: 0.9em;
      color: #d63384;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📖 Devocional Bot API</h1>
    <p>API para gerenciar o bot automatizado de envio de textos bíblicos devocionais via WhatsApp.</p>
    ${swaggerLinks}
    <h2>Endpoints Disponíveis</h2>
    

    <div class="endpoint">
      <span class="method">POST</span>
      <strong>/send</strong>
      <p>Envia o devocional do dia atual para o grupo WhatsApp configurado.</p>
    </div>
    
    <div class="endpoint">
      <span class="method get">GET</span>
      <strong>/health</strong>
      <p>Verifica o status da aplicação e a conexão com o WhatsApp.</p>
    </div>
    
    <div class="endpoint">
      <span class="method get">GET</span>
      <strong>/readings</strong>
      <p>Retorna todas as leituras devocionais disponíveis. Use o parâmetro de query <code>?date=YYYY-MM-DD</code> para filtrar por data específica.</p>
    </div>
    
    <div class="endpoint">
      <span class="method get">GET</span>
      <strong>/readings/today</strong>
      <p>Retorna a leitura devocional do dia atual.</p>
    </div>
    
    <div class="endpoint">
      <span class="method get">GET</span>
      <strong>/qr</strong>
      <p>Exibe o QR code para pareamento do WhatsApp. Use <code>?reconnect=true</code> para forçar uma nova autenticação.</p>
    </div>
    ${swaggerEndpoints}
  </div>
</body>
</html>`, {
                status: 200,
                headers: addCorsHeaders({ 'Content-Type': 'text/html; charset=utf-8' })
              });
            }
            
            return new Response('Not Found', { status: 404 });
          }
        });
        
        const localIP = getLocalIP();
        logger.info(`🌐 HTTP server listening on http://${hostname}:${port}`);
        if (localIP && hostname === '0.0.0.0') {
          logger.info(`🌍 Acesso via rede local: http://${localIP}:${port}`);
          logger.info(`📱 QR Code via rede: http://${localIP}:${port}/qr`);
          logger.info(`📚 Swagger via rede: http://${localIP}:${port}/docs`);
        }
        
        if (process.env.GROUP_CHAT_ID) {
          tryInitializeBot().then((initSuccess) => {
            if (initSuccess) {
              // Start the scheduler after successful bot initialization
              bot.startScheduler();
              logger.info('🎯 Bot initialized and scheduler started. Press Ctrl+C to stop.');
            } else {
              logger.info('🎯 Server is running but bot initialization failed. Press Ctrl+C to stop.');
            }
          }).catch((error) => {
            logger.error('❌ Error during bot initialization', error);
            logger.info('🎯 Server is running but bot is not initialized. Press Ctrl+C to stop.');
          });
        } else {
          logger.warn('⚠️ GROUP_CHAT_ID not set. Bot will not be initialized. Server will start but WhatsApp features will not work.');
          logger.info('🎯 Server is running. Press Ctrl+C to stop.');
        }
        
        process.on('SIGINT', async () => {
          logger.info('\n🛑 Received SIGINT, shutting down gracefully...');
          await bot.close();
          process.exit(0);
        });

        process.on('SIGTERM', async () => {
          logger.info('\n🛑 Received SIGTERM, shutting down gracefully...');
          await bot.close();
          process.exit(0);
        });
        break;
    }
  } catch (error) {
    logger.error('💥 Fatal error', error);
    await bot.close();
    process.exit(1);
  }
}

// Execute main function if this is the main module
if (import.meta.url === `file://${process.argv[1]}` || import.meta.main) {
  main();
}
