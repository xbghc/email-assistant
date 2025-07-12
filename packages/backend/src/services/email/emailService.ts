import nodemailer from 'nodemailer';
import config from '../../config/index';
import logger from '../../utils/logger';
import EmailContentManager from './emailContentManager';
import EmailStatsService from './emailStatsService';

interface QueuedEmail {
  id: string;
  mailOptions: nodemailer.SendMailOptions;
  attempts: number;
  maxAttempts: number;
  nextRetryTime: Date;
}

class EmailCircuitBreaker {
  private failures = 0;
  private isOpen = false;
  private lastFailureTime = 0;
  private readonly failureThreshold = 3;
  private readonly resetTimeout = 60000; // 1分钟
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.isOpen) {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.isOpen = false;
        this.failures = 0;
        logger.info('📧 Email circuit breaker reset');
      } else {
        throw new Error('Email service temporarily unavailable');
      }
    }
    
    try {
      const result = await operation();
      this.failures = 0;
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();
      
      if (this.failures >= this.failureThreshold) {
        this.isOpen = true;
        logger.warn(`🚨 Email circuit breaker opened after ${this.failures} failures`);
      }
      
      throw error;
    }
  }
}

class EmailService {
  private transporter: nodemailer.Transporter;
  private contentManager: EmailContentManager;
  private statsService: EmailStatsService;
  private circuitBreaker: EmailCircuitBreaker;
  private emailQueue: QueuedEmail[] = [];
  private isConnected: boolean = false;
  private queueProcessInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.contentManager = new EmailContentManager();
    this.statsService = new EmailStatsService();
    this.circuitBreaker = new EmailCircuitBreaker();
    this.transporter = nodemailer.createTransport({
      host: config.email.smtp.host,
      port: config.email.smtp.port,
      secure: config.email.smtp.port === 465,
      pool: true, // 启用连接池
      maxConnections: 3,
      maxMessages: 10,
      connectionTimeout: 30000,
      socketTimeout: 30000,
      auth: {
        user: config.email.smtp.user,
        pass: config.email.smtp.pass,
      },
    });
  }

  async initialize(): Promise<void> {
    await this.statsService.initialize();
    await this.verifyConnection();
    this.startQueueProcessor();
  }
  
  private startQueueProcessor(): void {
    this.queueProcessInterval = setInterval(() => {
      this.processEmailQueue().catch(error => {
        logger.error('📧 Email queue processing error:', error);
      });
    }, 60000); // 每分钟处理一次队列
  }
  
  private async processEmailQueue(): Promise<void> {
    if (this.emailQueue.length === 0) return;
    
    logger.debug(`📨 Processing ${this.emailQueue.length} queued emails`);
    
    const emailsToProcess = [...this.emailQueue];
    this.emailQueue = [];
    
    for (const queuedEmail of emailsToProcess) {
      if (Date.now() < queuedEmail.nextRetryTime.getTime()) {
        this.emailQueue.push(queuedEmail);
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
          this.emailQueue.push(queuedEmail);
          logger.warn(`📧 Email ${queuedEmail.id} queued for retry (${queuedEmail.attempts}/${queuedEmail.maxAttempts})`);
        } else {
          logger.error(`❌ Email ${queuedEmail.id} failed permanently`);
        }
      }
    }
  }
  
  private generateEmailId(): string {
    return `email_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  async sendEmail(subject: string, content: string, isHtml: boolean = false, toEmail?: string, contentType: 'help' | 'response' | 'notification' = 'response'): Promise<void> {
    // 优化邮件内容长度
    const optimizedContent = this.contentManager.optimizeEmailContent(content, contentType);
    
    // 记录优化统计
    const stats = this.contentManager.getContentStats(content);
    if (stats.needsOptimization) {
      logger.info(`Email content optimized: ${stats.length} → ${optimizedContent.length} chars`);
    }

    const mailOptions = {
      from: config.email.smtp.user,
      to: toEmail || config.email.user.email,
      subject,
      [isHtml ? 'html' : 'text']: optimizedContent,
    };

    try {
      // 尝试立即发送
      await this.circuitBreaker.execute(async () => {
        await this.transporter.sendMail(mailOptions);
      });
      
      logger.debug(`📧 Email sent: ${mailOptions.to}: ${subject}`);
      
      // 记录成功统计
      await this.statsService.recordEmailSent({
        to: mailOptions.to,
        subject,
        type: this.getEmailType(subject, contentType),
        status: 'sent'
      });
      
    } catch (error) {
      // 立即发送失败，加入队列
      const queuedEmail: QueuedEmail = {
        id: this.generateEmailId(),
        mailOptions: mailOptions,
        attempts: 0,
        maxAttempts: 3,
        nextRetryTime: new Date(Date.now() + 30000) // 30秒后重试
      };
      
      this.emailQueue.push(queuedEmail);
      logger.warn(`📪 Email queued for retry: ${queuedEmail.id} (${error})`);
      
      // 记录初始失败，但不抛出错误
      await this.statsService.recordEmailSent({
        to: toEmail || config.email.user.email,
        subject,
        type: this.getEmailType(subject, contentType),
        status: 'failed',
        errorMessage: `Queued for retry: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }

  async sendEmailToUser(userEmail: string, subject: string, content: string, isHtml: boolean = false): Promise<void> {
    // 优化邮件内容长度
    const optimizedContent = this.contentManager.optimizeEmailContent(content, 'notification');
    
    const mailOptions = {
      from: config.email.smtp.user,
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
      // 加入队列重试
      const queuedEmail: QueuedEmail = {
        id: this.generateEmailId(),
        mailOptions: mailOptions,
        attempts: 0,
        maxAttempts: 3,
        nextRetryTime: new Date(Date.now() + 30000)
      };
      
      this.emailQueue.push(queuedEmail);
      logger.warn(`📪 User email queued: ${queuedEmail.id}`);
      
      await this.statsService.recordEmailSent({
        to: userEmail,
        subject,
        type: this.getEmailType(subject, 'notification'),
        status: 'failed',
        errorMessage: `Queued for retry: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }

  async sendMorningReminder(scheduleContent: string, suggestions: string): Promise<void> {
    const subject = `📅 每日日程提醒 - ${new Date().toLocaleDateString()}`;
    const content = `
早上好，${config.email.user.name}！

这是您今天的日程安排：

${scheduleContent}

基于昨天的表现，这里有一些建议：

${suggestions}

祝您今天工作愉快！

此致，
您的邮件助手
    `.trim();

    await this.sendEmail(subject, content);
  }

  async sendEveningReminder(): Promise<void> {
    const subject = `📝 每日工作总结请求 - ${new Date().toLocaleDateString()}`;
    const content = `
晚上好，${config.email.user.name}！

现在是时候回顾您的一天了。请回复此邮件并告诉我：

1. 您今天完成了哪些任务？
2. 您的主要成就是什么？
3. 您遇到了什么挑战？
4. 您明天的计划是什么？

您的回复将帮助我提供更好的建议并跟踪您的进展。

此致，
您的邮件助手
    `.trim();

    await this.sendEmail(subject, content);
  }

  async sendWorkSummary(summary: string): Promise<void> {
    const subject = `📊 每日工作总结 - ${new Date().toLocaleDateString()}`;
    const content = `
您好 ${config.email.user.name}，

这是您今天的工作总结报告：

${summary}

继续保持出色的工作！

此致，
您的邮件助手
    `.trim();

    await this.sendEmail(subject, content);
  }

  async forwardEmail(
    originalFrom: string,
    originalSubject: string,
    originalContent: string,
    originalDate: Date,
    originalTo?: string[]
  ): Promise<void> {
    try {
      const forwardSubject = `📧 转发邮件: ${originalSubject}`;
      const forwardContent = `
📧 转发邮件

发件人: ${originalFrom}
收件人: ${originalTo?.join(', ') || '无'}
日期: ${originalDate.toLocaleString()}
主题: ${originalSubject}

──────────────────────

${originalContent}

──────────────────────

此邮件由您的邮件助手自动转发。
      `.trim();

      await this.sendEmail(forwardSubject, forwardContent);
      logger.info(`Email forwarded from ${originalFrom}: ${originalSubject}`);
    } catch (error) {
      logger.error('Failed to forward email:', error);
      throw error;
    }
  }

  async sendNewUserWelcomeEmail(userName: string, userEmail: string, morningTime: string, eveningTime: string): Promise<void> {
    const subject = `🎉 欢迎加入邮件助手服务！`;
    const content = `
亲爱的 ${userName}，

欢迎使用智能邮件助手服务！🎊

📋 您的账户信息：
• 姓名：${userName}
• 邮箱：${userEmail}
• 早晨提醒时间：${morningTime}
• 晚间提醒时间：${eveningTime}

🤖 您现在可以享受以下服务：
• 每日早晨日程提醒和建议
• 每日晚间工作报告收集和总结
• 智能邮件对话和任务管理
• 个性化提醒时间设置

💡 使用小贴士：
1. 直接回复邮件与AI助手对话
2. 说"请把我的早晨提醒改到8点"来调整时间
3. 说"标记所有邮件为已读"来管理邮件
4. 说"显示我的配置"来查看当前设置

如有任何问题，请随时回复此邮件咨询。

祝您使用愉快！

此致，
智能邮件助手团队
    `.trim();

    await this.sendEmail(subject, content, false, userEmail);
  }

  async sendSystemStartupNotification(userCount: number): Promise<void> {
    const subject = `🚀 邮件助手系统启动通知`;
    const content = `
亲爱的管理员，

邮件助手系统已成功启动！🎯

📊 系统状态：
• 启动时间：${new Date().toLocaleString()}
• 注册用户数：${userCount} 人
• AI服务商：${config.ai.provider.toUpperCase()}
• 邮件服务：已连接
• 定时任务：已启动

🔧 管理员功能：
• /adduser <email> <name> [早晨时间] [晚间时间] - 添加用户
• /listusers - 查看所有用户
• /deleteuser <email> - 删除用户
• /updateuser <email> <字段> <值> - 更新用户
• /stats - 查看统计信息
• /help - 查看帮助

💡 提示：发送邮件标题以 / 开头即可执行管理员命令。

系统正在监控邮件并为用户提供服务...

此致，
邮件助手系统
    `.trim();

    await this.sendEmail(subject, content, false, undefined, 'notification');
  }

  async sendUserAddedNotification(adminName: string, newUserName: string, newUserEmail: string): Promise<void> {
    const subject = `✅ 用户添加成功通知`;
    const content = `
管理员 ${adminName}，

新用户添加成功！🎉

👤 新用户信息：
• 姓名：${newUserName}
• 邮箱：${newUserEmail}
• 添加时间：${new Date().toLocaleString()}
• 状态：已启用

📧 系统已自动向新用户发送欢迎邮件，包含：
• 服务介绍和使用指南
• 账户配置信息
• 常用功能说明

新用户现在可以开始使用邮件助手服务了！

此致，
邮件助手管理系统
    `.trim();

    await this.sendEmail(subject, content);
  }

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
  
  // 获取邮件服务状态
  getServiceStatus() {
    return {
      isConnected: this.isConnected,
      queueLength: this.emailQueue.length,
      circuitBreakerOpen: this.circuitBreaker ? true : false,
      config: {
        smtpHost: config.email.smtp.host,
        smtpPort: config.email.smtp.port,
        smtpUserConfigured: !!config.email.smtp.user,
        smtpPassConfigured: !!config.email.smtp.pass,
        imapHost: config.email.imap.host,
        imapPort: config.email.imap.port,
        imapUserConfigured: !!config.email.imap.user,
        imapPassConfigured: !!config.email.imap.pass
      },
      lastConnection: {
        timestamp: new Date(),
        success: this.isConnected
      }
    };
  }
  
  // 优雅关闭
  async shutdown(): Promise<void> {
    if (this.queueProcessInterval) {
      clearInterval(this.queueProcessInterval);
    }
    
    // 处理剩余队列
    if (this.emailQueue.length > 0) {
      logger.info(`📨 Processing ${this.emailQueue.length} remaining emails...`);
      await this.processEmailQueue();
    }
    
    this.transporter.close();
    logger.info('📧 Email service shutdown complete');
  }

  /**
   * 根据邮件主题和内容类型确定邮件类型
   */
  private getEmailType(subject: string, contentType: string): 'reminder' | 'report' | 'suggestion' | 'system' | 'admin' {
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