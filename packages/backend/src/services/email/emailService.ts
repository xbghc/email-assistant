import nodemailer from 'nodemailer';
import config from '../../config/index';
import logger from '../../utils/logger';
import EmailContentManager from './emailContentManager';
import EmailStatsService from './emailStatsService';
import AIService from '../ai/aiService';

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
  private aiService: AIService;
  private emailQueue: QueuedEmail[] = [];
  private isConnected: boolean = false;
  private queueProcessInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.contentManager = new EmailContentManager();
    this.statsService = new EmailStatsService();
    this.circuitBreaker = new EmailCircuitBreaker();
    this.aiService = new AIService();
    this.transporter = nodemailer.createTransport({
      host: config.email.smtp.host,
      port: config.email.smtp.port,
      secure: config.email.smtp.secure,
      pool: true, // 启用连接池
      maxConnections: 3,
      maxMessages: 10,
      connectionTimeout: 30000,
      socketTimeout: 30000,
      auth: {
        user: config.email.user,
        pass: config.email.pass,
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
      from: config.email.user,
      to: toEmail || config.email.user,
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
        to: toEmail || config.email.user,
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
    try {
      const today = new Date();
      const dateStr = today.toLocaleDateString('zh-CN', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        weekday: 'long' 
      });
      
      // 获取天气和时间信息
      const timeOfDay = today.getHours();
      const greeting = timeOfDay < 6 ? '早安' : 
                      timeOfDay < 12 ? '早上好' : 
                      timeOfDay < 14 ? '上午好' : '下午好';
      
      // 使用AI生成个性化的晨间提醒内容
      const aiPrompt = `请为用户生成一份个性化的晨间提醒邮件内容。

用户信息：
- 姓名：${config.email.name || '朋友'}
- 日期：${dateStr}
- 时间：${greeting}

今日日程：
${scheduleContent}

昨日表现建议：
${suggestions}

请生成一份温暖、专业且富有激励性的晨间提醒邮件，包含：
1. 个性化的问候语
2. 对今日日程的精炼总结和重点提醒
3. 基于昨日表现的鼓励性建议
4. 积极正面的祝福和激励

语言要求：中文，语气友好专业，长度控制在300字以内。`;

      const aiGeneratedContent = await this.aiService.generateResponse(
        aiPrompt,
        '',
        { maxTokens: 500, temperature: 0.7 }
      );

      const subject = `📅 ${greeting}！今日日程提醒 - ${today.toLocaleDateString()}`;
      
      // 如果AI生成失败，使用备用模板
      const content = aiGeneratedContent || `
${greeting}，${config.email.name}！

这是您今天的日程安排：

${scheduleContent}

基于昨天的表现，这里有一些建议：

${suggestions}

祝您今天工作愉快！

此致，
您的邮件助手
      `.trim();

      await this.sendEmail(subject, content);
      
      logger.info(`Morning reminder sent with AI-generated content: ${aiGeneratedContent ? 'success' : 'fallback'}`);
    } catch (error) {
      logger.error('Failed to send morning reminder:', error);
      throw error;
    }
  }

  async sendEveningReminder(): Promise<void> {
    try {
      const today = new Date();
      const dateStr = today.toLocaleDateString('zh-CN', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        weekday: 'long' 
      });
      
      const timeOfDay = today.getHours();
      const greeting = timeOfDay < 18 ? '下午好' : 
                      timeOfDay < 21 ? '晚上好' : '深夜好';
      
      // 使用AI生成个性化的晚间提醒内容
      const aiPrompt = `请为用户生成一份个性化的晚间工作总结请求邮件。

用户信息：
- 姓名：${config.email.name || '朋友'}
- 日期：${dateStr}
- 时间：${greeting}

请生成一份温暖、鼓励且专业的晚间邮件，包含：
1. 个性化的问候语和对一天辛苦工作的认可
2. 引导用户进行自我反思的问题（包括成就、挑战、学习等）
3. 鼓励用户分享明天的计划和目标
4. 温暖的结尾和对用户的支持

要求：
- 语言：中文，语气友好温暖
- 长度：300字以内
- 包含具体的引导性问题
- 体现对用户工作的关心和支持`;

      const aiGeneratedContent = await this.aiService.generateResponse(
        aiPrompt,
        '',
        { maxTokens: 500, temperature: 0.7 }
      );

      const subject = `📝 ${greeting}！工作总结时间 - ${today.toLocaleDateString()}`;
      
      // 如果AI生成失败，使用备用模板
      const content = aiGeneratedContent || `
${greeting}，${config.email.name}！

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
      
      logger.info(`Evening reminder sent with AI-generated content: ${aiGeneratedContent ? 'success' : 'fallback'}`);
    } catch (error) {
      logger.error('Failed to send evening reminder:', error);
      throw error;
    }
  }

  async sendWorkSummary(summary: string): Promise<void> {
    try {
      const today = new Date();
      const dateStr = today.toLocaleDateString('zh-CN', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        weekday: 'long' 
      });
      
      const timeOfDay = today.getHours();
      const greeting = timeOfDay < 18 ? '下午好' : 
                      timeOfDay < 21 ? '晚上好' : '深夜好';
      
      // 使用AI生成个性化的工作总结邮件
      const aiPrompt = `请为用户生成一份个性化的工作总结报告邮件。

用户信息：
- 姓名：${config.email.name || '朋友'}
- 日期：${dateStr}
- 时间：${greeting}

工作总结内容：
${summary}

请生成一份专业、鼓励且具有洞察力的工作总结邮件，包含：
1. 对用户工作成果的认可和赞扬
2. 对总结内容的专业分析和提炼
3. 基于总结的积极反馈和建议
4. 对用户未来工作的鼓励和期待

要求：
- 语言：中文，语气专业且鼓励
- 长度：400字以内
- 体现对用户工作的深度理解
- 提供建设性的反馈和建议`;

      const aiGeneratedContent = await this.aiService.generateResponse(
        aiPrompt,
        '',
        { maxTokens: 600, temperature: 0.6 }
      );

      const subject = `📊 ${greeting}！您的工作总结报告 - ${today.toLocaleDateString()}`;
      
      // 如果AI生成失败，使用备用模板
      const content = aiGeneratedContent || `
您好 ${config.email.name}，

这是您今天的工作总结报告：

${summary}

继续保持出色的工作！

此致，
您的邮件助手
      `.trim();

      await this.sendEmail(subject, content);
      
      logger.info(`Work summary sent with AI-generated content: ${aiGeneratedContent ? 'success' : 'fallback'}`);
    } catch (error) {
      logger.error('Failed to send work summary:', error);
      throw error;
    }
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
    try {
      const today = new Date();
      const timeOfDay = today.getHours();
      const greeting = timeOfDay < 12 ? '上午好' : 
                      timeOfDay < 18 ? '下午好' : '晚上好';
      
      // 使用AI生成个性化的欢迎邮件
      const aiPrompt = `请为新用户生成一份个性化的智能邮件助手欢迎邮件。

用户信息：
- 姓名：${userName}
- 邮箱：${userEmail}
- 早晨提醒时间：${morningTime}
- 晚间提醒时间：${eveningTime}
- 注册时间：${greeting}

请生成一份热情、专业且信息全面的欢迎邮件，包含：
1. 个性化的欢迎问候
2. 对用户加入的欢迎和感谢
3. 清晰的服务功能介绍
4. 实用的使用指南和技巧
5. 鼓励性的结尾和支持信息

要求：
- 语言：中文，语气热情友好
- 长度：500字以内
- 包含具体的功能说明
- 体现专业性和可信度
- 让用户感受到被重视和支持`;

      const aiGeneratedContent = await this.aiService.generateResponse(
        aiPrompt,
        '',
        { maxTokens: 700, temperature: 0.8 }
      );

      const subject = `🎉 ${greeting}！欢迎加入智能邮件助手服务！`;
      
      // 如果AI生成失败，使用备用模板
      const content = aiGeneratedContent || `
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
      
      logger.info(`Welcome email sent to ${userEmail} with AI-generated content: ${aiGeneratedContent ? 'success' : 'fallback'}`);
    } catch (error) {
      logger.error('Failed to send welcome email:', error);
      throw error;
    }
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

  async sendVerificationCode(email: string, code: string): Promise<void> {
    const subject = `🔐 登录验证码`;
    const content = `
您好，

您的登录验证码是：

${code}

🕒 验证码有效期：30分钟
🔒 为了保障您的账户安全，请勿将验证码泄露给他人

如果这不是您本人的操作，请忽略此邮件。

此致，
邮件助手安全团队
    `.trim();

    await this.sendEmailToUser(email, subject, content);
    logger.info(`Verification code sent to: ${email}`);
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