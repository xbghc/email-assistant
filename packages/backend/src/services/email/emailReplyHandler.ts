import logger from '../../utils/logger';
import AIService from '../ai/aiService';
import ContextService from '../reports/contextService';
import EmailService from './emailService';
import UserService from '../user/userService';
import AdminCommandService from '../admin/adminCommandService';
import SecurityService from '../system/securityService';
import { ParsedEmail } from './emailReceiveService';
import { ContextEntry } from '../../models';

// 前向声明避免循环依赖

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
  private adminCommandService: AdminCommandService | null;
  private securityService: SecurityService;

  constructor() {
    this.aiService = new AIService();
    this.contextService = new ContextService();
    this.emailService = new EmailService();
    this.userService = new UserService();
    // 避免循环依赖：延迟初始化AdminCommandService
    this.adminCommandService = null;
    this.securityService = new SecurityService(this.userService);
  }

  async initialize(): Promise<void> {
    await this.contextService.initialize();
    await this.userService.initialize();
    
    // 延迟初始化AdminCommandService避免循环依赖
    if (!this.adminCommandService) {
      this.adminCommandService = new AdminCommandService(this.userService);
    }
    
    logger.info('Email reply handler initialized');
  }

  /**
   * 设置SchedulerService引用（避免循环依赖）
   */
  setSchedulerService(schedulerService: unknown): void {
    // 为AdminCommandService设置SchedulerService引用
    if (this.adminCommandService && schedulerService) {
      (this.adminCommandService as unknown as { schedulerService?: unknown }).schedulerService = schedulerService;
    }
  }

  async handleEmailReply(email: ParsedEmail): Promise<ProcessedReply> {
    try {
      logger.debug(`Processing ${email.replyType} email from ${email.from}`);
      logger.debug(`Email subject: ${email.subject}`);
      logger.debug(`Email content preview: ${email.textContent.substring(0, 100)}...`);

      // 设置用户ID
      const fromEmail = this.extractEmailAddress(email.from);
      const user = this.userService.getUserByEmail(fromEmail);
      email.userId = user?.id || undefined;

      const cleanContent = this.cleanEmailContent(email.textContent);
      logger.debug(`Cleaned content preview: ${cleanContent.substring(0, 100)}...`);
      
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
      
      // 检查用户是否为管理员（基于用户数据库而不是邮件标志）
      const fromEmail = this.extractEmailAddress(email.from);
      const user = this.userService.getUserByEmail(fromEmail);
      const isActualAdmin = user && user.role === 'admin';
      
      if (!isActualAdmin) {
        // 记录安全违规
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

      const commandResult = await this.adminCommandService?.processCommand(email.subject, content);
      
      // 让AI生成完整的管理员命令回复
      const adminReply = await this.aiService.generateResponseWithFunctionCalls(
        '你是邮件助手的管理系统。请为管理员命令执行结果生成一个专业的回复邮件。',
        `管理员执行的命令: ${email.subject}\n命令结果: ${commandResult}\n执行时间: ${new Date().toLocaleString()}`,
        { maxTokens: 1500, temperature: 0.3 }
      );
      
      await this.emailService.sendEmail(`Re: ${email.subject}`, adminReply, false, fromEmail);
      
      return {
        type: 'admin_command',
        originalContent: content,
        processedContent: commandResult || 'No result returned',
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

      // 让AI生成完整的日程反馈回复
      // todo: 这里是做了两次AI生成吗?
      const scheduleReply = await this.aiService.generateResponseWithFunctionCalls(
        '你是一个智能邮件助手。用户对日程安排提供了反馈，请生成一个友好、专业的确认回复邮件。',
        `用户反馈: ${content}\n我的建议回复: ${response}\n用户姓名: ${email.from.split('<')[0]?.trim() || '朋友'}`,
        { maxTokens: 2000, temperature: 0.7 },
        email.userId
      );

      const fromEmail = this.extractEmailAddress(email.from);
      await this.emailService.sendEmail(`Re: ${email.subject}`, scheduleReply, false, fromEmail);

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
        .map((entry: ContextEntry) => `[${entry.timestamp.toISOString()}] ${entry.type}: ${entry.content}`)
        .join('\n\n');

      // 使用Function Call功能处理用户请求
      // AI现在需要智能识别邮件类型并调用相应的功能
      const systemPrompt = `你是一个智能邮件助手，能够处理各种类型的邮件：

1. 工作报告/总结：如果用户描述了工作内容、完成的任务、今日成果等，请生成专业的工作总结
2. 日程安排：如果用户询问或要求安排日程、设置提醒、时间管理等，请提供相应的日程建议
3. 提醒设置：如果用户要求修改提醒时间、通知设置等，请使用相应的功能
4. 一般咨询：回答用户的问题并提供帮助

请根据邮件内容自动判断类型并提供最合适的回复。始终用中文回复，语气友好专业。`;

      const aiResponse = await this.aiService.generateResponseWithFunctionCalls(
        systemPrompt,
        `用户邮件主题：${email.subject}\n用户消息：${content}\n\n最近记录：${contextText}`,
        { maxTokens: 2000, temperature: 0.7 },
        email.userId
      );

      // AI已经生成了完整的回复内容，直接使用
      const fromEmail = this.extractEmailAddress(email.from);
      const replySubject = `Re: ${email.subject.replace(/^(Re:|RE:|回复：)\s*/i, '')}`;
      await this.emailService.sendEmail(replySubject, aiResponse, false, fromEmail);

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