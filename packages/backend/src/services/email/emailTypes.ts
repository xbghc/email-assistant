import nodemailer from 'nodemailer';

/**
 * 邮件队列中的邮件项
 */
export interface QueuedEmail {
  id: string;
  mailOptions: nodemailer.SendMailOptions;
  attempts: number;
  maxAttempts: number;
  nextRetryTime: Date;
}

/**
 * 邮件内容类型
 */
export type EmailContentType = 'help' | 'response' | 'notification';

/**
 * 邮件类型分类
 */
export type EmailType = 'reminder' | 'report' | 'suggestion' | 'system' | 'admin';

/**
 * 邮件发送状态
 */
export type EmailStatus = 'sent' | 'failed';

/**
 * 邮件服务状态
 */
export interface EmailServiceStatus {
  isConnected: boolean;
  queueLength: number;
  circuitBreakerOpen: boolean;
  config: {
    smtpHost: string;
    smtpPort: number;
    smtpUserConfigured: boolean;
    smtpPassConfigured: boolean;
    imapHost: string;
    imapPort: number;
    imapUserConfigured: boolean;
    imapPassConfigured: boolean;
  };
  lastConnection: {
    timestamp: Date;
    success: boolean;
  };
}

/**
 * AI生成选项
 */
export interface AIGenerationOptions {
  maxTokens: number;
  temperature: number;
}

/**
 * 邮件发送记录
 */
export interface EmailSendRecord {
  to: string;
  subject: string;
  type: EmailType;
  status: EmailStatus;
  errorMessage?: string;
  userId?: string;
}