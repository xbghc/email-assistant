import nodemailer from 'nodemailer';
import config from '../../config/index';
import logger from '../../utils/logger';
import EmailContentManager from './emailContentManager';
import EmailStatsService from './emailStatsService';
import { EmailCircuitBreaker } from './emailCircuitBreaker';
import { EmailQueue } from './emailQueue';
import { EmailTemplateGenerator } from './emailTemplates';
import { 
  EmailContentType, 
  EmailType, 
  EmailServiceStatus
} from './emailTypes';
import { 
  CONNECTION_CONFIG, 
  LOG_MESSAGES
} from './emailConstants';

/**
 * 邮件服务主类
 * 负责邮件发送、队列管理、状态监控等核心功能
 */
class EmailService {
  private transporter: nodemailer.Transporter;
  private contentManager: EmailContentManager;
  private statsService: EmailStatsService;
  private circuitBreaker: EmailCircuitBreaker;
  private emailQueue: EmailQueue;
  private templateGenerator: EmailTemplateGenerator;
  private isConnected: boolean = false;

  constructor() {
    this.contentManager = new EmailContentManager();
    this.statsService = new EmailStatsService();
    this.circuitBreaker = new EmailCircuitBreaker();
    this.templateGenerator = new EmailTemplateGenerator();
    
    this.transporter = nodemailer.createTransport({
      host: config.email.smtp.host,
      port: config.email.smtp.port,
      secure: config.email.smtp.secure,
      pool: CONNECTION_CONFIG.POOL_ENABLED,
      maxConnections: CONNECTION_CONFIG.MAX_CONNECTIONS,
      maxMessages: CONNECTION_CONFIG.MAX_MESSAGES,
      connectionTimeout: CONNECTION_CONFIG.CONNECTION_TIMEOUT,
      socketTimeout: CONNECTION_CONFIG.SOCKET_TIMEOUT,
      auth: {
        user: config.email.user,
        pass: config.email.pass,
      },
    });

    this.emailQueue = new EmailQueue(this.circuitBreaker, this.transporter);
  }

  /**
   * 初始化邮件服务
   */
  async initialize(): Promise<void> {
    await this.statsService.initialize();
    await this.verifyConnection();
    this.emailQueue.startProcessor();
    logger.info(LOG_MESSAGES.SERVICE_INITIALIZED);
  }

  /**
   * 发送邮件的核心方法
   */
  async sendEmail(
    subject: string, 
    content: string, 
    isHtml: boolean = false, 
    toEmail?: string, 
    contentType: EmailContentType = 'response'
  ): Promise<void> {
    const optimizedContent = this.contentManager.optimizeEmailContent(content, contentType);
    
    const stats = this.contentManager.getContentStats(content);
    if (stats.needsOptimization) {
      logger.info(`Email content optimized: ${stats.length} → ${optimizedContent.length} chars`);
    }

    const mailOptions = {
      from: config.email.user,
      to: toEmail || config.email.user,
      subject,
      [isHtml ? 'html' : 'text']: optimizedContent,
    };

    try {
      await this.circuitBreaker.execute(async () => {
        await this.transporter.sendMail(mailOptions);
      });
      
      logger.debug(`📧 Email sent: ${mailOptions.to}: ${subject}`);
      
      await this.statsService.recordEmailSent({
        to: mailOptions.to,
        subject,
        type: this.getEmailType(subject, contentType),
        status: 'sent'
      });
      
    } catch (error) {
      this.emailQueue.addToQueue(mailOptions);
      
      await this.statsService.recordEmailSent({
        to: toEmail || config.email.user,
        subject,
        type: this.getEmailType(subject, contentType),
        status: 'failed',
        errorMessage: `Queued for retry: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }

  /**
   * 发送邮件给指定用户
   */
  async sendEmailToUser(
    userEmail: string, 
    subject: string, 
    content: string, 
    isHtml: boolean = false
  ): Promise<void> {
    const optimizedContent = this.contentManager.optimizeEmailContent(content, 'notification');
    
    const mailOptions = {
      from: config.email.user,
      to: userEmail,
      subject,
      [isHtml ? 'html' : 'text']: optimizedContent,
    };

    try {
      await this.circuitBreaker.execute(async () => {
        await this.transporter.sendMail(mailOptions);
      });
      
      logger.debug(`📧 Email sent to user ${userEmail}: ${subject}`);
      
      await this.statsService.recordEmailSent({
        to: userEmail,
        subject,
        type: this.getEmailType(subject, 'notification'),
        status: 'sent'
      });
      
    } catch (error) {
      this.emailQueue.addToQueue(mailOptions);
      
      await this.statsService.recordEmailSent({
        to: userEmail,
        subject,
        type: this.getEmailType(subject, 'notification'),
        status: 'failed',
        errorMessage: `Queued for retry: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }

  /**
   * 发送晨间提醒
   */
  async sendMorningReminder(scheduleContent: string, suggestions: string): Promise<void> {
    try {
      const template = await this.templateGenerator.generateMorningReminder(scheduleContent, suggestions);
      
      await this.sendEmail(template.subject, template.content);
      
      logger.info(`Morning reminder sent with AI-generated content: ${template.isAIGenerated ? 'success' : 'fallback'}`);
    } catch (error) {
      logger.error('Failed to send morning reminder:', error);
      throw error;
    }
  }

  /**
   * 发送晚间提醒
   */
  async sendEveningReminder(): Promise<void> {
    try {
      const template = await this.templateGenerator.generateEveningReminder();
      
      await this.sendEmail(template.subject, template.content);
      
      logger.info(`Evening reminder sent with AI-generated content: ${template.isAIGenerated ? 'success' : 'fallback'}`);
    } catch (error) {
      logger.error('Failed to send evening reminder:', error);
      throw error;
    }
  }

  /**
   * 发送工作总结
   */
  async sendWorkSummary(summary: string): Promise<void> {
    try {
      const template = await this.templateGenerator.generateWorkSummary(summary);
      
      await this.sendEmail(template.subject, template.content);
      
      logger.info(`Work summary sent with AI-generated content: ${template.isAIGenerated ? 'success' : 'fallback'}`);
    } catch (error) {
      logger.error('Failed to send work summary:', error);
      throw error;
    }
  }

  /**
   * 转发邮件
   */
  async forwardEmail(
    originalFrom: string,
    originalSubject: string,
    originalContent: string,
    originalDate: Date,
    originalTo?: string[]
  ): Promise<void> {
    try {
      const template = this.templateGenerator.generateForwardEmail(
        originalFrom,
        originalSubject,
        originalContent,
        originalDate,
        originalTo
      );

      await this.sendEmail(template.subject, template.content);
      logger.info(`Email forwarded from ${originalFrom}: ${originalSubject}`);
    } catch (error) {
      logger.error('Failed to forward email:', error);
      throw error;
    }
  }

  /**
   * 发送新用户欢迎邮件
   */
  async sendNewUserWelcomeEmail(
    userName: string, 
    userEmail: string, 
    morningTime: string, 
    eveningTime: string
  ): Promise<void> {
    try {
      const template = await this.templateGenerator.generateNewUserWelcome(
        userName,
        userEmail,
        morningTime,
        eveningTime
      );

      await this.sendEmail(template.subject, template.content, false, userEmail);
      
      logger.info(`Welcome email sent to ${userEmail} with AI-generated content: ${template.isAIGenerated ? 'success' : 'fallback'}`);
    } catch (error) {
      logger.error('Failed to send welcome email:', error);
      throw error;
    }
  }

  /**
   * 发送系统启动通知
   */
  async sendSystemStartupNotification(userCount: number): Promise<void> {
    const template = this.templateGenerator.generateSystemStartupNotification(userCount);
    await this.sendEmail(template.subject, template.content, false, undefined, 'notification');
  }

  /**
   * 发送用户添加通知
   */
  async sendUserAddedNotification(
    adminName: string, 
    newUserName: string, 
    newUserEmail: string
  ): Promise<void> {
    const template = this.templateGenerator.generateUserAddedNotification(
      adminName,
      newUserName,
      newUserEmail
    );
    await this.sendEmail(template.subject, template.content);
  }

  /**
   * 发送验证码
   */
  async sendVerificationCode(email: string, code: string): Promise<void> {
    const template = this.templateGenerator.generateVerificationCode(email, code);
    
    await this.sendEmailToUser(email, template.subject, template.content);
    logger.info(`Verification code sent to: ${email}`);
  }

  /**
   * 验证邮件连接
   */
  async verifyConnection(): Promise<boolean> {
    try {
      await this.circuitBreaker.execute(async () => {
        await this.transporter.verify();
      });
      this.isConnected = true;
      logger.info('✅ Email service connection verified');
      return true;
    } catch (error) {
      this.isConnected = false;
      logger.warn('⚠️  Email service connection failed, emails will be queued:', error);
      return false;
    }
  }

  /**
   * 获取邮件服务状态
   */
  getServiceStatus(): EmailServiceStatus {
    return {
      isConnected: this.isConnected,
      queueLength: this.emailQueue.getQueueLength(),
      circuitBreakerOpen: this.circuitBreaker.getStatus().isOpen,
      config: {
        smtpHost: config.email.smtp.host,
        smtpPort: config.email.smtp.port,
        smtpUserConfigured: !!config.email.user,
        smtpPassConfigured: !!config.email.pass,
        imapHost: config.email.imap.host,
        imapPort: config.email.imap.port,
        imapUserConfigured: !!config.email.user,
        imapPassConfigured: !!config.email.pass
      },
      lastConnection: {
        timestamp: new Date(),
        success: this.isConnected
      }
    };
  }

  /**
   * 优雅关闭
   */
  async shutdown(): Promise<void> {
    await this.emailQueue.gracefulShutdown();
    this.transporter.close();
    logger.info(LOG_MESSAGES.SERVICE_SHUTDOWN);
  }

  /**
   * 根据邮件主题和内容类型确定邮件类型
   */
  private getEmailType(subject: string, contentType: string): EmailType {
    if (subject.includes('提醒') || subject.includes('reminder')) {
      return 'reminder';
    }
    if (subject.includes('周报') || subject.includes('报告') || subject.includes('report')) {
      return 'report';
    }
    if (subject.includes('建议') || subject.includes('suggestion')) {
      return 'suggestion';
    }
    if (subject.includes('系统') || subject.includes('启动') || subject.includes('关闭') || contentType === 'notification') {
      return 'system';
    }
    return 'admin';
  }

  /**
   * 获取邮件发送统计
   */
  getEmailStats() {
    return this.statsService.getEmailStats();
  }

  /**
   * 获取邮件趋势数据
   */
  getEmailTrendData(days: number = 7) {
    return this.statsService.getEmailTrendData(days);
  }
}

export default EmailService;