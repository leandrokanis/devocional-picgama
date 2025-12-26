import 'dotenv/config';
import cron from 'node-cron';
import { DevotionalService } from './services/devotional.js';
import { WhatsAppService } from './services/whatsapp.js';
import { logger } from './utils/logger.js';

class DevotionalBot {
  private devotionalService: DevotionalService;
  private whatsappService: WhatsAppService;
  private isInitialized = false;

  constructor() {
    this.devotionalService = new DevotionalService(process.env.DATA_PATH);
    this.whatsappService = new WhatsAppService({
      sessionName: process.env.WHATSAPP_SESSION_NAME || 'devocional-bot',
      groupChatId: process.env.GROUP_CHAT_ID || '',
      debug: process.env.DEBUG === 'true'
    });
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
        await this.initialize();
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
      scheduled: true,
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
}

async function main() {
  const bot = new DevotionalBot();

  const command = process.argv[2];

  try {
    switch (command) {
      case 'test':
        await bot.testConnection();
        break;
      case 'send':
        await bot.sendTodaysDevotional();
        break;
      case 'start':
      default:
        await bot.initialize();
        bot.setupScheduler();
        
        logger.info('🎯 Bot is running and scheduled. Press Ctrl+C to stop.');
        
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

if (import.meta.main) {
  main();
}
