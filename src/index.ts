import 'dotenv/config';
import cron from 'node-cron';
import { DevotionalService } from './services/devotional.js';
import { WhatsAppService } from './services/whatsapp.js';
import { logger } from './utils/logger.js';

class DevotionalBot {
  private devotionalService: DevotionalService;
  private whatsappService: WhatsAppService;
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
      this.currentQRCode = base64;
      logger.info('🔗 QR Code salvo! Acesse http://localhost:3001/qr para visualizar');
    };
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

  public setupScheduler(): void {
    const sendTime = process.env.SEND_TIME || '07:00';
    const timezone = process.env.TIMEZONE || 'America/Sao_Paulo';
    
    const [hour, minute] = sendTime.split(':').map(Number);
    const cronExpression = `${minute} ${hour} * * *`;

    logger.info(`⏰ Scheduling daily devotional at ${sendTime} (${timezone})`);
    
    cron.schedule(cronExpression, async () => {
      logger.info('🕐 Scheduled devotional execution started');
      await this.sendTodaysDevotional();
    }, {
      timezone: timezone
    });

    logger.info('📅 Scheduler configured successfully');
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
}

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
        const serverPort = process.env.PORT || process.env.SERVER_PORT || '3000';
        const serverHost = process.env.SERVER_HOST || 'localhost';
        const url = `http://${serverHost}:${serverPort}/send`;
        
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
        
        let botInitialized = false;
        
        const tryInitializeBot = async () => {
          if (botInitialized) return true;
          try {
            await bot.initialize();
            botInitialized = true;
            return true;
          } catch (error) {
            logger.warn('⚠️ Bot initialization failed, but server will continue running', error);
            
            // In production, set a flag to disable WhatsApp and continue
            if (process.env.NODE_ENV === 'production') {
              process.env.DISABLE_WHATSAPP = 'true';
              logger.info('🔧 WhatsApp disabled due to initialization failure in production');
            }
            
            return false;
          }
        };
        
        Bun.serve({
          port,
          hostname,
          async fetch(req) {
            const url = new URL(req.url);
            const isDevelopment = process.env.NODE_ENV !== 'production';
            
            logger.debug(`📥 ${req.method} ${url.pathname}${url.search}`);
            
            if (url.pathname === '/send' && req.method === 'POST') {
              try {
                logger.info('📨 Received send request via HTTP');
                
                if (!process.env.GROUP_CHAT_ID) {
                  return new Response(JSON.stringify({ 
                    success: false, 
                    error: 'GROUP_CHAT_ID environment variable is required' 
                  }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                  });
                }
                
                const success = await bot.sendTodaysDevotional();
                
                if (success) {
                  return new Response(JSON.stringify({ 
                    success: true, 
                    message: 'Devotional sent successfully' 
                  }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                  });
                } else {
                  return new Response(JSON.stringify({ 
                    success: false, 
                    error: 'Failed to send devotional' 
                  }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                  });
                }
              } catch (error) {
                logger.error('❌ Error handling send request', error);
                return new Response(JSON.stringify({ 
                  success: false, 
                  error: error instanceof Error ? error.message : 'Unknown error' 
                }), {
                  status: 500,
                  headers: { 'Content-Type': 'application/json' }
                });
              }
            }
            
            if (url.pathname === '/health' && req.method === 'GET') {
              const isConnected = bot.getConnectionStatus();
              return new Response(JSON.stringify({ 
                status: 'ok', 
                connected: isConnected,
                hasQRCode: bot.currentQRCode !== null
              }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
              });
            }
            
            if (url.pathname === '/qr' && req.method === 'GET') {
              if (!bot.currentQRCode) {
                return new Response(JSON.stringify({ 
                  error: 'No QR code available. WhatsApp may already be connected or initializing.' 
                }), {
                  status: 404,
                  headers: { 'Content-Type': 'application/json' }
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
    .refresh-btn {
      margin-top: 20px;
      padding: 10px 20px;
      background: #25D366;
      color: white;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-size: 16px;
    }
    .refresh-btn:hover {
      background: #128C7E;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📱 WhatsApp QR Code</h1>
    <p>Escaneie o código QR abaixo com seu WhatsApp:</p>
    
    <div class="qr-code">
      <img src="data:image/png;base64,${bot.currentQRCode}" alt="WhatsApp QR Code" style="max-width: 300px;">
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
    
    <button class="refresh-btn" onclick="window.location.reload()">🔄 Atualizar QR Code</button>
  </div>
  
  <script>
    // Auto refresh every 15 seconds
    setTimeout(() => {
      window.location.reload();
    }, 15000);
  </script>
</body>
</html>`;
              
              return new Response(qrHtml, {
                status: 200,
                headers: { 'Content-Type': 'text/html; charset=utf-8' }
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
                    headers: { 'Content-Type': 'application/json' }
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
                
                const spec = {
                  ...swaggerData,
                  servers: [
                    {
                      url: `http://${hostname === '0.0.0.0' ? 'localhost' : hostname}:${port}`,
                      description: 'Servidor atual'
                    }
                  ]
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
                headers: { 'Content-Type': 'text/html; charset=utf-8' }
              });
            }
            
            if (url.pathname === '/' && req.method === 'GET') {
              const swaggerLinks = isDevelopment ? `
    <div class="links">
      <a href="/docs">📚 Documentação Swagger</a>
      <a href="/api-docs">📄 OpenAPI Spec (JSON)</a>
    </div>` : '';
              
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
      <p>Exibe o QR code para pareamento do WhatsApp (se disponível).</p>
    </div>
    ${swaggerEndpoints}
  </div>
</body>
</html>`, {
                status: 200,
                headers: { 'Content-Type': 'text/html; charset=utf-8' }
              });
            }
            
            return new Response('Not Found', { status: 404 });
          }
        });
        
        logger.info(`🌐 HTTP server listening on http://${hostname}:${port}`);
        
        if (process.env.GROUP_CHAT_ID) {
          tryInitializeBot().then((initSuccess) => {
            if (initSuccess) {
              bot.setupScheduler();
              logger.info('🎯 Bot initialized and scheduler configured. Press Ctrl+C to stop.');
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
