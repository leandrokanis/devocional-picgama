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
    if (this.isRunning) return;
    const cronExpression = this.convertTimeToCron(this.config.sendTime);
    this.task = cron.schedule(cronExpression, async () => {
      await this.executeTask();
    }, {
      timezone: this.config.timezone
    });
    this.isRunning = true;
    logger.info('Scheduler started');
  }

  public stop(): void {
    if (this.task) {
      this.task.stop();
      this.task = null;
    }
    this.isRunning = false;
    logger.info('Scheduler stopped');
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
    if (parts.length !== 2) throw new Error(`Invalid time format: ${time}`);
    const hours = parseInt(parts[0] || '0', 10);
    const minutes = parseInt(parts[1] || '0', 10);
    if (Number.isNaN(hours) || Number.isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      throw new Error(`Invalid time format: ${time}`);
    }
    return `${minutes} ${hours} * * *`;
  }

  private async executeTask(): Promise<void> {
    try {
      const success = await this.config.onExecute();
      if (!success) {
        logger.warn('Scheduled devotional send failed');
      }
    } catch (error) {
      logger.error('Scheduled devotional execution error', error);
    }
  }

  private getNextExecutionTime(): string {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const [h, m] = this.config.sendTime.split(':');
    tomorrow.setHours(parseInt(h || '0', 10), parseInt(m || '0', 10), 0, 0);
    return tomorrow.toLocaleString('pt-BR', {
      timeZone: this.config.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}
