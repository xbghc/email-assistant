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
    const subject = `📅 Daily Schedule Reminder - ${new Date().toLocaleDateString()}`;
    const content = `
Good morning, ${config.email.user.name}!

Here's your schedule for today:

${scheduleContent}

Based on yesterday's performance, here are some suggestions:

${suggestions}

Have a productive day!

Best regards,
Your Email Assistant
    `.trim();

    await this.sendEmail(subject, content);
  }

  async sendEveningReminder(): Promise<void> {
    const subject = `📝 Daily Work Summary Request - ${new Date().toLocaleDateString()}`;
    const content = `
Good evening, ${config.email.user.name}!

It's time to reflect on your day. Please reply to this email with:

1. What tasks did you complete today?
2. What were your main achievements?
3. What challenges did you face?
4. What are your plans for tomorrow?

Your response will help me provide better suggestions and track your progress.

Best regards,
Your Email Assistant
    `.trim();

    await this.sendEmail(subject, content);
  }

  async sendWorkSummary(summary: string): Promise<void> {
    const subject = `📊 Daily Work Summary - ${new Date().toLocaleDateString()}`;
    const content = `
Hello ${config.email.user.name},

Here's your summarized work report for today:

${summary}

Keep up the great work!

Best regards,
Your Email Assistant
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
      const forwardSubject = `📧 Forwarded Email: ${originalSubject}`;
      const forwardContent = `
📧 FORWARDED EMAIL

From: ${originalFrom}
To: ${originalTo?.join(', ') || 'N/A'}
Date: ${originalDate.toLocaleString()}
Subject: ${originalSubject}

──────────────────────

${originalContent}

──────────────────────

This email was automatically forwarded by your Email Assistant.
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