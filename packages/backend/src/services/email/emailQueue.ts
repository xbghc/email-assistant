import nodemailer from 'nodemailer';
import logger from '../../utils/logger';
import { QueuedEmail } from './emailTypes';
import { EmailCircuitBreaker } from './emailCircuitBreaker';

/**
 * 邮件队列管理器
 * 负责管理邮件发送队列和重试机制
 */
export class EmailQueue {
  private queue: QueuedEmail[] = [];
  private queueProcessInterval: NodeJS.Timeout | null = null;
  private circuitBreaker: EmailCircuitBreaker;
  private transporter: nodemailer.Transporter;

  constructor(circuitBreaker: EmailCircuitBreaker, transporter: nodemailer.Transporter) {
    this.circuitBreaker = circuitBreaker;
    this.transporter = transporter;
  }

  /**
   * 启动队列处理器
   */
  startProcessor(): void {
    this.queueProcessInterval = setInterval(() => {
      this.processQueue().catch(error => {
        logger.error('📧 Email queue processing error:', error);
      });
    }, 60000); // 每分钟处理一次队列
  }

  /**
   * 停止队列处理器
   */
  stopProcessor(): void {
    if (this.queueProcessInterval) {
      clearInterval(this.queueProcessInterval);
      this.queueProcessInterval = null;
    }
  }

  /**
   * 添加邮件到队列
   * @param mailOptions 邮件选项
   * @param maxAttempts 最大重试次数
   * @returns 队列中的邮件ID
   */
  addToQueue(mailOptions: nodemailer.SendMailOptions, maxAttempts: number = 3): string {
    const queuedEmail: QueuedEmail = {
      id: this.generateEmailId(),
      mailOptions: mailOptions,
      attempts: 0,
      maxAttempts,
      nextRetryTime: new Date(Date.now() + 30000) // 30秒后重试
    };

    this.queue.push(queuedEmail);
    logger.warn(`📪 Email queued for retry: ${queuedEmail.id}`);
    
    return queuedEmail.id;
  }

  /**
   * 处理邮件队列
   */
  private async processQueue(): Promise<void> {
    if (this.queue.length === 0) return;
    
    logger.debug(`📨 Processing ${this.queue.length} queued emails`);
    
    const emailsToProcess = [...this.queue];
    this.queue = [];
    
    for (const queuedEmail of emailsToProcess) {
      if (Date.now() < queuedEmail.nextRetryTime.getTime()) {
        this.queue.push(queuedEmail);
        continue;
      }
      
      try {
        await this.circuitBreaker.execute(async () => {
          await this.transporter.sendMail(queuedEmail.mailOptions);
        });
        
        logger.info(`✅ Queued email sent: ${queuedEmail.id}`);
        
      } catch {
        queuedEmail.attempts++;
        
        if (queuedEmail.attempts < queuedEmail.maxAttempts) {
          const delay = Math.pow(2, queuedEmail.attempts) * 30000; // 30s, 60s, 120s
          queuedEmail.nextRetryTime = new Date(Date.now() + delay);
          this.queue.push(queuedEmail);
          logger.warn(`📧 Email ${queuedEmail.id} queued for retry (${queuedEmail.attempts}/${queuedEmail.maxAttempts})`);
        } else {
          logger.error(`❌ Email ${queuedEmail.id} failed permanently`);
        }
      }
    }
  }

  /**
   * 生成邮件ID
   */
  private generateEmailId(): string {
    return `email_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * 获取队列状态
   */
  getStatus(): {
    queueLength: number;
    emailsInQueue: Array<{
      id: string;
      attempts: number;
      maxAttempts: number;
      nextRetryTime: Date;
    }>;
  } {
    return {
      queueLength: this.queue.length,
      emailsInQueue: this.queue.map(email => ({
        id: email.id,
        attempts: email.attempts,
        maxAttempts: email.maxAttempts,
        nextRetryTime: email.nextRetryTime
      }))
    };
  }

  /**
   * 清空队列
   */
  clearQueue(): void {
    this.queue = [];
    logger.info('📧 Email queue cleared');
  }

  /**
   * 获取队列长度
   */
  getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * 优雅关闭 - 处理剩余队列
   */
  async gracefulShutdown(): Promise<void> {
    this.stopProcessor();
    
    if (this.queue.length > 0) {
      logger.info(`📨 Processing ${this.queue.length} remaining emails...`);
      await this.processQueue();
    }
  }
}

export default EmailQueue;