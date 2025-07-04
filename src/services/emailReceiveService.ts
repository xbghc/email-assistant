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
  replyType?: 'work_report' | 'schedule_response' | 'general' | undefined;
}

class EmailReceiveService extends EventEmitter {
  private imap: Imap;
  private isConnected: boolean = false;
  private checkInterval?: NodeJS.Timeout;
  private processedEmails: Set<string> = new Set();

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
    }
    
    if (this.isConnected) {
      this.imap.end();
    }
    
    logger.info('Email receive service stopped');
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
      markSeen: true
    });

    fetch.on('message', (msg, seqno) => {
      let buffer = Buffer.alloc(0);
      
      msg.on('body', (stream) => {
        stream.on('data', (chunk) => {
          buffer = Buffer.concat([buffer, chunk]);
        });
        
        stream.once('end', () => {
          this.parseEmail(buffer, seqno);
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

  private async parseEmail(buffer: Buffer, seqno: number): Promise<void> {
    try {
      const parsed = await simpleParser(buffer);
      
      if (!parsed.messageId || this.processedEmails.has(parsed.messageId)) {
        return;
      }

      this.processedEmails.add(parsed.messageId);

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
      };

      if (email.isReply && email.from.includes(config.email.user.email)) {
        logger.info(`Processing reply email: ${email.subject}`);
        this.emit('emailReceived', email);
      }
    } catch (error) {
      logger.error(`Failed to parse email ${seqno}:`, error);
    }
  }

  private isReplyEmail(parsed: any): boolean {
    return !!(parsed.inReplyTo || 
             (parsed.references && parsed.references.length > 0) ||
             (parsed.subject && (
               parsed.subject.startsWith('Re:') || 
               parsed.subject.startsWith('RE:') ||
               parsed.subject.startsWith('回复：')
             )));
  }

  private determineReplyType(parsed: any): 'work_report' | 'schedule_response' | 'general' {
    const subject = (parsed.subject || '').toLowerCase();
    const content = (parsed.text || '').toLowerCase();

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

  isConnectedToImap(): boolean {
    return this.isConnected;
  }
}

export default EmailReceiveService;