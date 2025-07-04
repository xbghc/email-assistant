import logger from '../utils/logger';
import AIService from './aiService';
import ContextService from './contextService';
import EmailService from './emailService';
import UserService from './userService';
import AdminCommandService from './adminCommandService';
import SecurityService from './securityService';
import { ParsedEmail } from './emailReceiveService';

export interface ProcessedReply {
  type: 'work_report' | 'schedule_response' | 'general' | 'admin_command';
  originalContent: string;
  processedContent: string;
  response?: string;
  userId?: string | undefined;
}

class EmailReplyHandler {
  private aiService: AIService;
  private contextService: ContextService;
  private emailService: EmailService;
  private userService: UserService;
  private adminCommandService: AdminCommandService;
  private securityService: SecurityService;

  constructor() {
    this.aiService = new AIService();
    this.contextService = new ContextService();
    this.emailService = new EmailService();
    this.userService = new UserService();
    this.adminCommandService = new AdminCommandService(this.userService);
    this.securityService = new SecurityService(this.userService);
  }

  async initialize(): Promise<void> {
    await this.contextService.initialize();
    await this.userService.initialize();
    logger.info('Email reply handler initialized');
  }

  async handleEmailReply(email: ParsedEmail): Promise<ProcessedReply> {
    try {
      logger.info(`Processing ${email.replyType} email from ${email.from}`);
      logger.info(`Email subject: ${email.subject}`);
      logger.info(`Email content preview: ${email.textContent.substring(0, 100)}...`);

      // 设置用户ID
      const fromEmail = this.extractEmailAddress(email.from);
      const user = this.userService.getUserByEmail(fromEmail);
      email.userId = user?.id || undefined;

      const cleanContent = this.cleanEmailContent(email.textContent);
      logger.info(`Cleaned content preview: ${cleanContent.substring(0, 100)}...`);
      
      switch (email.replyType) {
        case 'admin_command':
          return await this.handleAdminCommand(email, cleanContent);
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

  private async handleAdminCommand(email: ParsedEmail, content: string): Promise<ProcessedReply> {
    try {
      logger.info('Processing admin command');
      
      if (!email.isFromAdmin) {
        // 记录安全违规
        const fromEmail = this.extractEmailAddress(email.from);
        const shouldDisable = await this.securityService.recordUnauthorizedAccess(fromEmail, email.subject);
        
        const warningMessage = shouldDisable 
          ? '您因多次尝试未授权访问已被禁用。请联系管理员。'
          : '您无权执行管理员命令。此次尝试已被记录。';
        
        return {
          type: 'admin_command',
          originalContent: content,
          processedContent: warningMessage,
          response: 'Unauthorized admin command access recorded.'
        };
      }

      const commandResult = await this.adminCommandService.processCommand(email.subject, content);
      
      // 发送命令结果给管理员
      const replySubject = `命令结果: ${email.subject}`;
      const replyContent = `
管理员命令执行结果:

命令: ${email.subject}
结果:
${commandResult}

执行时间: ${new Date().toLocaleString()}

此致，
邮件助手管理系统
      `.trim();
      
      await this.emailService.sendEmail(replySubject, replyContent);
      
      return {
        type: 'admin_command',
        originalContent: content,
        processedContent: commandResult,
        response: 'Admin command processed successfully.'
      };
    } catch (error) {
      logger.error('Failed to process admin command:', error);
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
          timestamp: email.date,
          userId: email.userId
        }
      );

      const recentContext = await this.contextService.getRecentContext(7, email.userId);
      const summary = await this.aiService.summarizeWorkReport(content, recentContext);

      await this.emailService.sendWorkSummary(summary);

      await this.contextService.addEntry(
        'conversation',
        `Work summary generated and sent: ${summary}`,
        { 
          originalReport: content,
          emailId: email.messageId,
          userId: email.userId
        }
      );

      return {
        type: 'work_report',
        originalContent: content,
        processedContent: summary,
        response: 'Work report processed and summary sent successfully.',
        userId: email.userId
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
          timestamp: email.date,
          userId: email.userId
        }
      );

      const recentContext = await this.contextService.getRecentContext(3, email.userId);
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
        response: 'Schedule feedback acknowledged and additional suggestions sent.',
        userId: email.userId
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
          timestamp: email.date,
          userId: email.userId
        }
      );

      const recentContext = await this.contextService.getRecentContext(5, email.userId);
      const contextText = recentContext
        .slice(-5)
        .map(entry => `[${entry.timestamp.toISOString()}] ${entry.type}: ${entry.content}`)
        .join('\n\n');

      // 使用Function Call功能处理用户请求
      const aiResponse = await this.aiService.generateResponseWithFunctionCalls(
        '你是一个贴心的邮件助手，可以帮助用户管理日程安排、标记邮件已读和配置提醒时间。如果用户要求修改时间或标记邮件，请使用相应的功能。请始终用中文回复。',
        `用户消息：${content}\n\n最近记录：${contextText}`,
        { maxTokens: 500, temperature: 0.7 },
        email.userId
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
        response: 'General inquiry processed and response sent.',
        userId: email.userId
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

  private extractEmailAddress(fromText: string): string {
    if (!fromText) return '';
    const emailMatch = fromText.match(/<([^>]+)>/) || fromText.match(/([^\s<>]+@[^\s<>]+)/);
    return emailMatch ? emailMatch[1] || '' : fromText;
  }
}

export default EmailReplyHandler;