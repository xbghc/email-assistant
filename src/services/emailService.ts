import nodemailer from 'nodemailer';
import config from '../config';
import logger from '../utils/logger';

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: config.email.smtp.host,
      port: config.email.smtp.port,
      secure: config.email.smtp.port === 465,
      auth: {
        user: config.email.smtp.user,
        pass: config.email.smtp.pass,
      },
    });
  }

  async sendEmail(subject: string, content: string, isHtml: boolean = false): Promise<void> {
    try {
      const mailOptions = {
        from: config.email.smtp.user,
        to: config.email.user.email,
        subject,
        [isHtml ? 'html' : 'text']: content,
      };

      await this.transporter.sendMail(mailOptions);
      logger.info(`Email sent successfully: ${subject}`);
    } catch (error) {
      logger.error('Failed to send email:', error);
      throw error;
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

  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      logger.info('Email service connection verified');
      return true;
    } catch (error) {
      logger.error('Email service connection failed:', error);
      return false;
    }
  }
}

export default EmailService;