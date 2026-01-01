import * as cron from 'node-cron';
import { logger } from '../utils/logger.js';

export interface SchedulerConfig {
  sendTime: string;
  timezone: string;
  onExecute: () => Promise<boolean>;
}

export class SchedulerService {
  private task: cron.ScheduledTask | null = null;
  private config: SchedulerConfig;
  private isRunning = false;

  constructor(config: SchedulerConfig) {
    this.config = config;
  }

  public start(): void {
    if (this.isRunning) {
      logger.warn('⚠️ Scheduler is already running');
      return;
    }

    const cronExpression = this.convertTimeToCron(this.config.sendTime);
    
    logger.info(`⏰ Starting scheduler: ${this.config.sendTime} (${cronExpression}) - Timezone: ${this.config.timezone}`);

    this.task = cron.schedule(cronExpression, async () => {
      await this.executeTask();
    }, {
      timezone: this.config.timezone
    });

    this.isRunning = true;
    logger.info('✅ Scheduler started successfully');
  }

  public stop(): void {
    if (this.task) {
      this.task.stop();
      this.task = null;
    }
    this.isRunning = false;
    logger.info('🛑 Scheduler stopped');
  }

  public getStatus(): { running: boolean; nextExecution?: string; sendTime: string; timezone: string } {
    return {
      running: this.isRunning,
      nextExecution: this.task ? this.getNextExecutionTime() : undefined,
      sendTime: this.config.sendTime,
      timezone: this.config.timezone
    };
  }

  private convertTimeToCron(time: string): string {
    const parts = time.split(':');
    if (parts.length !== 2) {
      throw new Error(`Invalid time format: ${time}. Expected format: HH:MM`);
    }

    const hours = parseInt(parts[0] || '0', 10);
    const minutes = parseInt(parts[1] || '0', 10);
    
    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      throw new Error(`Invalid time format: ${time}. Expected format: HH:MM`);
    }

    return `${minutes} ${hours} * * *`;
  }

  private async executeTask(): Promise<void> {
    const startTime = new Date();
    logger.info('🚀 Executing scheduled devotional send...');

    try {
      const success = await this.config.onExecute();
      const duration = Date.now() - startTime.getTime();

      if (success) {
        logger.info(`✅ Scheduled devotional sent successfully in ${duration}ms`);
      } else {
        logger.error(`❌ Scheduled devotional failed in ${duration}ms`);
        await this.retryTask();
      }
    } catch (error) {
      const duration = Date.now() - startTime.getTime();
      logger.error(`💥 Scheduled devotional error in ${duration}ms:`, error);
      await this.retryTask();
    }
  }

  private async retryTask(): Promise<void> {
    const maxRetries = 3;
    const retryDelay = 5 * 60 * 1000; // 5 minutes

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      logger.info(`🔄 Retry attempt ${attempt}/${maxRetries} in ${retryDelay / 1000} seconds...`);
      
      await new Promise(resolve => setTimeout(resolve, retryDelay));

      try {
        const success = await this.config.onExecute();
        if (success) {
          logger.info(`✅ Retry ${attempt} successful`);
          return;
        } else {
          logger.warn(`⚠️ Retry ${attempt} failed`);
        }
      } catch (error) {
        logger.error(`❌ Retry ${attempt} error:`, error);
      }
    }

    logger.error(`💥 All ${maxRetries} retry attempts failed`);
  }

  private getNextExecutionTime(): string {
    if (!this.task) return 'N/A';

    try {
      const cronExpression = this.convertTimeToCron(this.config.sendTime);
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const timeParts = this.config.sendTime.split(':');
      if (timeParts.length !== 2) {
        return 'N/A';
      }
      const hours = parseInt(timeParts[0] || '0', 10);
      const minutes = parseInt(timeParts[1] || '0', 10);
      
      tomorrow.setHours(hours);
      tomorrow.setMinutes(minutes);
      tomorrow.setSeconds(0);
      tomorrow.setMilliseconds(0);

      return tomorrow.toLocaleString('pt-BR', { 
        timeZone: this.config.timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'N/A';
    }
  }

  public async executeNow(): Promise<boolean> {
    logger.info('🎯 Manual execution requested');
    return await this.config.onExecute();
  }
}