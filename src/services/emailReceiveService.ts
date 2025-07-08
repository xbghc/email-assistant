import Imap from 'imap';
import { simpleParser } from 'mailparser';
import config from '../config';
import logger from '../utils/logger';
import { EventEmitter } from 'events';

export interface ParsedEmail {
  messageId: string;
  subject: string;
  from: string;
  to: string[];
  date: Date;
  textContent: string;
  htmlContent?: string | undefined;
  inReplyTo?: string | undefined;
  references?: string[] | undefined;
  isReply: boolean;
  replyType?: 'work_report' | 'schedule_response' | 'general' | 'admin_command' | undefined;
  userId?: string | undefined; // 用户ID，用于多用户支持
  isFromAdmin?: boolean; // 是否来自管理员
}

class EmailReceiveService extends EventEmitter {
  private imap: Imap;
  private isConnected: boolean = false;
  private checkInterval?: NodeJS.Timeout | undefined;
  private processedEmails: Set<string> = new Set();
  private emailCleanupInterval?: NodeJS.Timeout | undefined;
  private readonly MAX_PROCESSED_EMAILS = 10000; // 最大保持的已处理邮件数量

  constructor() {
    super();
    this.imap = new Imap({
      user: config.email.imap.user,
      password: config.email.imap.pass,
      host: config.email.imap.host,
      port: config.email.imap.port,
      tls: config.email.imap.tls,
      tlsOptions: {
        rejectUnauthorized: config.email.imap.rejectUnauthorized,
        secureProtocol: 'TLSv1_2_method'
      },
      authTimeout: 10000,
      connTimeout: 10000,
    });

    this.setupEventHandlers();
    this.setupEmailCleanup();
  }

  private setupEventHandlers(): void {
    this.imap.once('ready', () => {
      logger.info('IMAP connection ready');
      this.isConnected = true;
      this.openInbox();
    });

    this.imap.once('error', (err: Error) => {
      logger.error('IMAP connection error:', err);
      this.isConnected = false;
    });

    this.imap.once('end', () => {
      logger.info('IMAP connection ended');
      this.isConnected = false;
    });
  }

  async start(): Promise<void> {
    try {
      if (!config.email.imap.user || !config.email.imap.pass) {
        throw new Error('IMAP credentials not configured');
      }

      this.imap.connect();
      
      this.checkInterval = setInterval(() => {
        if (this.isConnected) {
          this.checkForNewEmails();
        }
      }, config.email.imap.checkIntervalMs);

      logger.info('Email receive service started');
    } catch (error) {
      logger.error('Failed to start email receive service:', error);
      throw error;
    }
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }
    
    if (this.emailCleanupInterval) {
      clearInterval(this.emailCleanupInterval);
      this.emailCleanupInterval = undefined;
    }

    if (this.isConnected) {
      this.imap.end();
    }
    
    // 清理内存
    this.processedEmails.clear();
    this.removeAllListeners();
    
    logger.info('Email receive service stopped and cleaned up');
  }

  private openInbox(): void {
    this.imap.openBox('INBOX', false, (err, _box) => {
      if (err) {
        logger.error('Failed to open inbox:', err);
        return;
      }
      logger.info('Inbox opened successfully');
      this.checkForNewEmails();
    });
  }

  private checkForNewEmails(): void {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      this.imap.search([
        'UNSEEN',
        ['SINCE', yesterday],
        ['TO', config.email.user.email]
      ], (err, results) => {
        if (err) {
          logger.error('Email search error:', err);
          return;
        }

        if (results.length === 0) {
          return;
        }

        logger.info(`Found ${results.length} new emails`);
        this.processEmails(results);
      });
    } catch (error) {
      logger.error('Error checking for new emails:', error);
    }
  }

  private processEmails(uids: number[]): void {
    const fetch = this.imap.fetch(uids, {
      bodies: '',
      struct: true,
      markSeen: false  // 先不标记，处理完成后再标记
    });

    // 创建UID映射
    const uidMap = new Map<number, number>();
    let seqIndex = 0;

    fetch.on('message', (msg, seqno) => {
      let buffer = Buffer.alloc(0);
      const currentUid = uids[seqIndex++];
      if (currentUid !== undefined) {
        uidMap.set(seqno, currentUid);
      }
      
      msg.on('body', (stream) => {
        stream.on('data', (chunk) => {
          buffer = Buffer.concat([buffer, chunk]);
        });
        
        stream.once('end', () => {
          const uid = uidMap.get(seqno);
          this.parseEmail(buffer, seqno, uid);  // 传递UID用于后续标记
        });
      });

      msg.once('error', (err) => {
        logger.error(`Error processing email ${seqno}:`, err);
      });
    });

    fetch.once('error', (err) => {
      logger.error('Fetch error:', err);
    });

    fetch.once('end', () => {
      logger.info('Finished processing emails');
    });
  }

  private async parseEmail(buffer: Buffer, seqno: number, uid?: number): Promise<void> {
    try {
      const parsed = await simpleParser(buffer);
      
      if (!parsed.messageId || this.processedEmails.has(parsed.messageId)) {
        logger.debug(`Skipping duplicate email: ${parsed.messageId}`);
        // 即使是重复邮件，也需要标记为已读
        this.markEmailAsRead(uid);
        return;
      }

      this.processedEmails.add(parsed.messageId);
      this.cleanupProcessedEmailsIfNeeded();
      logger.debug(`Processing new email: ${parsed.messageId}`);

      const fromText = Array.isArray(parsed.from) 
        ? parsed.from[0]?.text || '' 
        : parsed.from?.text || '';
      const toText = Array.isArray(parsed.to) 
        ? parsed.to.map(addr => addr.text || '').filter(Boolean)
        : parsed.to?.text ? [parsed.to.text] : [];
      
      const email: ParsedEmail = {
        messageId: parsed.messageId || '',
        subject: parsed.subject || '',
        from: fromText,
        to: toText,
        date: parsed.date || new Date(),
        textContent: parsed.text || '',
        htmlContent: parsed.html || undefined,
        inReplyTo: parsed.inReplyTo || undefined,
        references: Array.isArray(parsed.references) ? parsed.references : parsed.references ? [parsed.references] : undefined,
        isReply: this.isReplyEmail(parsed),
        replyType: this.determineReplyType(parsed),
        isFromAdmin: this.isFromAdmin(fromText),
        userId: undefined as string | undefined, // 将在后续通过用户服务设置
      };

      // 处理来自用户的邮件（包括回复和直接发送的邮件）
      if (email.from.includes(config.email.user.email)) {
        logger.info(`Processing email from user: ${email.subject} (${email.replyType})`);
        this.emit('emailReceived', email);
        // 处理完成后标记邮件为已读
        this.markEmailAsRead(uid);
      } else {
        // 处理来自其他人的邮件 - 转发给用户
        logger.info(`Forwarding email from: ${email.from}, subject: ${email.subject}`);
        this.emit('emailForward', email);
        // 转发完成后标记邮件为已读
        this.markEmailAsRead(uid);
      }
    } catch (error) {
      logger.error(`Failed to parse email ${seqno}:`, error);
    }
  }

  private isReplyEmail(parsed: { inReplyTo?: string | undefined; references?: string | string[] | undefined; subject?: string | undefined }): boolean {
    return !!(parsed.inReplyTo || 
             (parsed.references && Array.isArray(parsed.references) && parsed.references.length > 0) ||
             (parsed.subject && (
               parsed.subject.startsWith('Re:') || 
               parsed.subject.startsWith('RE:') ||
               parsed.subject.startsWith('回复：')
             )));
  }

  private determineReplyType(parsed: { subject?: string | undefined; text?: string | undefined; from?: { text: string } | { text: string }[] | undefined }): 'work_report' | 'schedule_response' | 'general' | 'admin_command' {
    const subject = (parsed.subject || '').toLowerCase();
    const content = (parsed.text || '').toLowerCase();
    const fromText = Array.isArray(parsed.from) 
      ? parsed.from[0]?.text || '' 
      : parsed.from?.text || '';

    // 检查是否为管理员命令
    if (this.isFromAdmin(fromText) && parsed.subject && parsed.subject.startsWith('/')) {
      return 'admin_command';
    }

    if (subject.includes('work summary') || 
        subject.includes('daily work') ||
        subject.includes('工作总结') ||
        subject.includes('工作报告')) {
      return 'work_report';
    }

    if (subject.includes('schedule') || 
        subject.includes('reminder') ||
        subject.includes('日程') ||
        subject.includes('提醒')) {
      return 'schedule_response';
    }

    if (content.includes('完成') || 
        content.includes('任务') ||
        content.includes('工作') ||
        content.includes('accomplished') ||
        content.includes('completed') ||
        content.includes('tasks')) {
      return 'work_report';
    }

    return 'general';
  }

  private isFromAdmin(fromText: string): boolean {
    // 提取邮件地址
    const emailMatch = fromText.match(/<([^>]+)>/) || fromText.match(/([^\s<>]+@[^\s<>]+)/);
    const email = emailMatch ? emailMatch[1] : fromText;
    
    return email?.toLowerCase().trim() === config.email.user.email.toLowerCase();
  }

  isConnectedToImap(): boolean {
    return this.isConnected;
  }

  // 标记邮件为已读
  private markEmailAsRead(uid?: number): void {
    if (!uid || !this.isConnected) {
      return;
    }

    try {
      this.imap.addFlags(uid, ['\\Seen'], (err) => {
        if (err) {
          logger.error(`Failed to mark email ${uid} as read:`, err);
        } else {
          logger.debug(`Email ${uid} marked as read successfully`);
        }
      });
    } catch (error) {
      logger.error(`Error marking email ${uid} as read:`, error);
    }
  }

  // 获取发件人邮件地址
  extractEmailAddress(fromText: string): string {
    if (!fromText) return '';
    const emailMatch = fromText.match(/<([^>]+)>/) || fromText.match(/([^\s<>]+@[^\s<>]+)/);
    return emailMatch ? emailMatch[1] || '' : fromText;
  }

  // 设置邮件清理机制
  private setupEmailCleanup(): void {
    // 每小时清理一次已处理邮件列表
    this.emailCleanupInterval = setInterval(() => {
      this.cleanupProcessedEmailsIfNeeded();
    }, 60 * 60 * 1000); // 1小时
  }

  // 清理已处理邮件记录，防止内存泄漏
  private cleanupProcessedEmailsIfNeeded(): void {
    if (this.processedEmails.size > this.MAX_PROCESSED_EMAILS) {
      // 保留最近一半的记录，删除较早的记录
      const emailsArray = Array.from(this.processedEmails);
      const keepCount = Math.floor(this.MAX_PROCESSED_EMAILS / 2);
      const toKeep = emailsArray.slice(-keepCount);
      
      this.processedEmails.clear();
      toKeep.forEach(email => this.processedEmails.add(email));
      
      logger.info(`Cleaned up processed emails cache, kept ${toKeep.length} recent entries`);
    }
  }

}

export default EmailReceiveService;