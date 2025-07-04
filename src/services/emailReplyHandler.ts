import logger from '../utils/logger';
import AIService from './aiService';
import ContextService from './contextService';
import EmailService from './emailService';
import { ParsedEmail } from './emailReceiveService';

export interface ProcessedReply {
  type: 'work_report' | 'schedule_response' | 'general';
  originalContent: string;
  processedContent: string;
  response?: string;
}

class EmailReplyHandler {
  private aiService: AIService;
  private contextService: ContextService;
  private emailService: EmailService;

  constructor() {
    this.aiService = new AIService();
    this.contextService = new ContextService();
    this.emailService = new EmailService();
  }

  async initialize(): Promise<void> {
    await this.contextService.initialize();
    logger.info('Email reply handler initialized');
  }

  async handleEmailReply(email: ParsedEmail): Promise<ProcessedReply> {
    try {
      logger.info(`Processing ${email.replyType} email from ${email.from}`);
      logger.info(`Email subject: ${email.subject}`);
      logger.info(`Email content preview: ${email.textContent.substring(0, 100)}...`);

      const cleanContent = this.cleanEmailContent(email.textContent);
      logger.info(`Cleaned content preview: ${cleanContent.substring(0, 100)}...`);
      
      switch (email.replyType) {
        case 'work_report':
          return await this.handleWorkReportReply(email, cleanContent);
        case 'schedule_response':
          return await this.handleScheduleResponse(email, cleanContent);
        default:
          return await this.handleGeneralReply(email, cleanContent);
      }
    } catch (error) {
      logger.error('Failed to handle email reply:', error);
      throw error;
    }
  }

  private async handleWorkReportReply(email: ParsedEmail, content: string): Promise<ProcessedReply> {
    try {
      logger.info('Processing work report reply');

      await this.contextService.addEntry(
        'work_summary',
        `Work report received via email: ${content}`,
        { 
          emailId: email.messageId,
          subject: email.subject,
          timestamp: email.date 
        }
      );

      const recentContext = await this.contextService.getRecentContext(7);
      const summary = await this.aiService.summarizeWorkReport(content, recentContext);

      await this.emailService.sendWorkSummary(summary);

      await this.contextService.addEntry(
        'conversation',
        `Work summary generated and sent: ${summary}`,
        { 
          originalReport: content,
          emailId: email.messageId 
        }
      );

      return {
        type: 'work_report',
        originalContent: content,
        processedContent: summary,
        response: 'Work report processed and summary sent successfully.'
      };
    } catch (error) {
      logger.error('Failed to process work report reply:', error);
      throw error;
    }
  }

  private async handleScheduleResponse(email: ParsedEmail, content: string): Promise<ProcessedReply> {
    try {
      logger.info('Processing schedule response');

      await this.contextService.addEntry(
        'schedule',
        `Schedule feedback received via email: ${content}`,
        { 
          emailId: email.messageId,
          subject: email.subject,
          timestamp: email.date 
        }
      );

      const recentContext = await this.contextService.getRecentContext(3);
      const response = await this.aiService.generateMorningSuggestions(
        '用户对日程安排的反馈',
        content,
        recentContext
      );

      const acknowledgeSubject = `📝 日程反馈已收到 - ${new Date().toLocaleDateString()}`;
      const acknowledgeContent = `
您好 ${email.from.split('<')[0]?.trim() || '朋友'},

感谢您对日程提醒的反馈。我已经记录了您的意见：

"${content}"

基于您的反馈，这里有一些额外的建议：

${response}

您的反馈帮助我提供更好的服务。继续保持出色的工作！

此致，
您的邮件助手
      `.trim();

      await this.emailService.sendEmail(acknowledgeSubject, acknowledgeContent);

      return {
        type: 'schedule_response',
        originalContent: content,
        processedContent: response,
        response: 'Schedule feedback acknowledged and additional suggestions sent.'
      };
    } catch (error) {
      logger.error('Failed to process schedule response:', error);
      throw error;
    }
  }

  private async handleGeneralReply(email: ParsedEmail, content: string): Promise<ProcessedReply> {
    try {
      logger.info('Processing general reply');

      await this.contextService.addEntry(
        'conversation',
        `General email received: ${content}`,
        { 
          emailId: email.messageId,
          subject: email.subject,
          timestamp: email.date 
        }
      );

      const recentContext = await this.contextService.getRecentContext(5);
      const contextText = recentContext
        .slice(-5)
        .map(entry => `[${entry.timestamp.toISOString()}] ${entry.type}: ${entry.content}`)
        .join('\n\n');

      const aiResponse = await this.aiService.generateMorningSuggestions(
        '用户一般询问',
        `用户消息：${content}\n\n最近记录：${contextText}`,
        recentContext
      );

      const replySubject = `回复: ${email.subject.replace(/^(Re:|RE:|回复：)\s*/i, '')}`;
      const replyContent = `
您好 ${email.from.split('<')[0]?.trim() || '朋友'},

感谢您的来信。我已经查看了您的询问：

"${content}"

${aiResponse}

如果您有其他问题或需要日程安排、工作规划方面的帮助，请随时回复此邮件。

此致，
您的邮件助手
      `.trim();

      await this.emailService.sendEmail(replySubject, replyContent);

      return {
        type: 'general',
        originalContent: content,
        processedContent: aiResponse,
        response: 'General inquiry processed and response sent.'
      };
    } catch (error) {
      logger.error('Failed to process general reply:', error);
      throw error;
    }
  }

  private cleanEmailContent(content: string): string {
    const lines = content.split('\n');
    const cleanLines: string[] = [];
    let foundOriginalMessage = false;

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine.startsWith('>') || 
          trimmedLine.startsWith('On ') && trimmedLine.includes('wrote:') ||
          trimmedLine.includes('Original Message') ||
          trimmedLine.includes('From:') && foundOriginalMessage ||
          foundOriginalMessage) {
        foundOriginalMessage = true;
        continue;
      }

      if (trimmedLine.length > 0) {
        cleanLines.push(trimmedLine);
      }
    }

    let cleanContent = cleanLines.join('\n').trim();
    
    cleanContent = cleanContent.replace(/^(Re:|RE:|回复：)\s*/i, '');
    cleanContent = cleanContent.replace(/Sent from my iPhone/gi, '');
    cleanContent = cleanContent.replace(/Sent from my Android/gi, '');
    
    return cleanContent;
  }
}

export default EmailReplyHandler;