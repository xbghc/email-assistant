import cron from 'node-cron';
import config from '../config';
import logger from '../utils/logger';
import EmailService from './emailService';
import AIService from './aiService';
import ContextService from './contextService';
import ScheduleService from './scheduleService';
import WeeklyReportService from './weeklyReportService';
import PersonalizationService from './personalizationService';
import EmailReceiveService, { ParsedEmail } from './emailReceiveService';
import EmailReplyHandler from './emailReplyHandler';
import ReminderTrackingService, { ReminderRecord } from './reminderTrackingService';

class SchedulerService {
  private emailService: EmailService;
  private aiService: AIService;
  private contextService: ContextService;
  private scheduleService: ScheduleService;
  private weeklyReportService: WeeklyReportService;
  private personalizationService: PersonalizationService;
  private emailReceiveService: EmailReceiveService;
  private emailReplyHandler: EmailReplyHandler;
  private reminderTracking: ReminderTrackingService;
  private morningTask?: cron.ScheduledTask;
  private eveningTask?: cron.ScheduledTask;
  private weeklyTask?: cron.ScheduledTask;
  private personalizationTask?: cron.ScheduledTask;

  constructor() {
    this.emailService = new EmailService();
    this.aiService = new AIService();
    this.contextService = new ContextService();
    this.scheduleService = new ScheduleService();
    this.weeklyReportService = new WeeklyReportService();
    this.personalizationService = new PersonalizationService();
    this.emailReceiveService = new EmailReceiveService();
    this.emailReplyHandler = new EmailReplyHandler();
    this.reminderTracking = new ReminderTrackingService();
  }

  async initialize(): Promise<void> {
    try {
      await this.contextService.initialize();
      await this.scheduleService.initialize();
      await this.weeklyReportService.initialize();
      await this.personalizationService.initialize();
      await this.reminderTracking.initialize();
      await this.emailService.verifyConnection();
      await this.emailReplyHandler.initialize();
      
      this.setupMorningReminder();
      this.setupEveningReminder();
      this.setupWeeklyReport();
      this.setupPersonalizationSuggestions();
      this.setupEmailReceiver();
      
      logger.info('📅 Scheduler configured for reminders');
    } catch (error) {
      logger.error('Failed to initialize scheduler service:', error);
      throw error;
    }
  }

  private setupMorningReminder(): void {
    const [hour, minute] = config.schedule.morningReminderTime.split(':');
    const cronPattern = `${minute} ${hour} * * *`;
    
    this.morningTask = cron.schedule(cronPattern, async () => {
      await this.sendMorningReminder();
    }, {
      scheduled: true,
      timezone: 'Asia/Shanghai',
    });

    // Morning reminder scheduled
  }

  private setupEveningReminder(): void {
    const [hour, minute] = config.schedule.eveningReminderTime.split(':');
    const cronPattern = `${minute} ${hour} * * *`;
    
    this.eveningTask = cron.schedule(cronPattern, async () => {
      await this.sendEveningReminder();
    }, {
      scheduled: true,
      timezone: 'Asia/Shanghai',
    });

    // Evening reminder scheduled
  }

  private setupWeeklyReport(): void {
    // 每周一早上9点发送周报
    this.weeklyTask = cron.schedule('0 9 * * 1', async () => {
      try {
        logger.info('Starting weekly report generation...');
        await this.weeklyReportService.generateAllUsersWeeklyReports(-1); // 生成上周的周报
        logger.info('Weekly reports generated and sent to all users');
      } catch (error) {
        logger.error('Failed to generate weekly reports:', error);
      }
    }, {
      scheduled: true,
      timezone: 'Asia/Shanghai'
    });

    logger.info('📊 Weekly report task scheduled for Mondays at 9:00 AM');
  }

  private setupPersonalizationSuggestions(): void {
    // 每两周的周五下午3点发送个性化建议
    this.personalizationTask = cron.schedule('0 15 * * 5', async () => {
      try {
        const now = new Date();
        const weekOfYear = Math.ceil((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
        
        // 只在偶数周发送（每两周一次）
        if (weekOfYear % 2 === 0) {
          logger.info('Starting personalized suggestions generation...');
          await this.personalizationService.generatePersonalizedSuggestionsForAllUsers();
          logger.info('Personalized suggestions generated and sent to all users');
        }
      } catch (error) {
        logger.error('Failed to generate personalized suggestions:', error);
      }
    }, {
      scheduled: true,
      timezone: 'Asia/Shanghai'
    });

    logger.info('🎯 Personalized suggestions task scheduled for every other Friday at 3:00 PM');
  }

  private setupEmailReceiver(): void {
    // 处理用户邮件回复
    this.emailReceiveService.on('emailReceived', async (email: ParsedEmail) => {
      try {
        logger.info(`Received email reply: ${email.subject} from ${email.from}`);
        const result = await this.emailReplyHandler.handleEmailReply(email);
        logger.info(`Email reply processed: ${result.type} - ${result.response}`);
      } catch (error) {
        logger.error('Failed to process email reply:', error);
      }
    });

    // 处理其他人的邮件转发
    this.emailReceiveService.on('emailForward', async (email: ParsedEmail) => {
      try {
        if (!config.email.forwarding.enabled) {
          logger.info(`Email forwarding disabled, skipping: ${email.subject} from ${email.from}`);
          return;
        }

        logger.info(`Forwarding email: ${email.subject} from ${email.from}`);
        await this.emailService.forwardEmail(
          email.from,
          email.subject,
          email.textContent,
          email.date,
          email.to
        );
        
        // 记录转发操作到上下文
        await this.contextService.addEntry(
          'conversation',
          `Email forwarded from ${email.from}: ${email.subject}`,
          { 
            originalFrom: email.from,
            originalSubject: email.subject,
            forwardedAt: new Date()
          }
        );
        
        logger.info(`Email forwarded successfully from ${email.from}`);
      } catch (error) {
        logger.error('Failed to forward email:', error);
      }
    });

    this.emailReceiveService.start().catch(error => {
      logger.error('Failed to start email receive service:', error);
    });

    logger.info('Email receiver setup completed');
  }

  private async sendMorningReminder(): Promise<void> {
    try {
      logger.info('Starting morning reminder process...');
      
      // 检查是否应该发送晨间提醒
      const shouldSend = await this.reminderTracking.shouldSendMorningReminder();
      if (!shouldSend) {
        logger.info('Morning reminder already sent today, skipping');
        return;
      }
      
      const todaySchedule = await this.scheduleService.getTodaySchedule();
      const scheduleText = todaySchedule 
        ? this.scheduleService.formatScheduleText(todaySchedule)
        : 'No scheduled events for today.';

      const recentContext = await this.contextService.getRecentContext(7);
      const yesterdayPerformance = await this.getYesterdayPerformance();
      
      const suggestions = await this.aiService.generateMorningSuggestions(
        scheduleText,
        yesterdayPerformance,
        recentContext
      );

      await this.emailService.sendMorningReminder(scheduleText, suggestions);
      
      // 标记晨间提醒已发送
      await this.reminderTracking.markMorningReminderSent();
      
      await this.contextService.addEntry(
        'schedule',
        `Morning reminder sent with schedule: ${scheduleText}`,
        { suggestions }
      );

      logger.info('Morning reminder sent successfully');
    } catch (error) {
      logger.error('Failed to send morning reminder:', error);
    }
  }

  private async sendEveningReminder(): Promise<void> {
    try {
      logger.info('Starting evening reminder process...');
      
      // 检查是否应该发送晚间提醒
      const shouldSend = await this.reminderTracking.shouldSendEveningReminder();
      if (!shouldSend) {
        logger.info('Evening reminder skipped - already sent or work report received today');
        return;
      }
      
      await this.emailService.sendEveningReminder();
      
      // 标记晚间提醒已发送
      await this.reminderTracking.markEveningReminderSent();
      
      await this.contextService.addEntry(
        'conversation',
        'Evening work summary request sent',
        { type: 'evening_reminder' }
      );

      logger.info('Evening reminder sent successfully');
    } catch (error) {
      logger.error('Failed to send evening reminder:', error);
    }
  }

  async processWorkReport(workReport: string, userId: string = 'admin'): Promise<void> {
    try {
      logger.info('Processing work report...');
      
      const recentContext = await this.contextService.getRecentContext(7, userId);
      const summary = await this.aiService.summarizeWorkReport(workReport, recentContext);
      
      await this.emailService.sendWorkSummary(summary);
      
      // 标记工作报告已接收
      await this.reminderTracking.markWorkReportReceived(userId);
      
      await this.contextService.addEntry(
        'work_summary',
        `Work report processed: ${workReport}`,
        { summary },
        userId
      );

      logger.info('Work report processed and summary sent');
    } catch (error) {
      logger.error('Failed to process work report:', error);
      throw error;
    }
  }

  private async getYesterdayPerformance(): Promise<string> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    const workSummaries = await this.contextService.getContextByType('work_summary', 5);
    const relevantSummary = workSummaries.find(entry => 
      entry.timestamp.toISOString().split('T')[0] === yesterdayStr
    );
    
    if (relevantSummary) {
      return relevantSummary.content;
    }
    
    return 'No performance data available for yesterday.';
  }

  async testMorningReminder(): Promise<void> {
    logger.info('Testing morning reminder...');
    await this.sendMorningReminder();
  }

  async testEveningReminder(): Promise<void> {
    logger.info('Testing evening reminder...');
    await this.sendEveningReminder();
  }

  getEmailReceiveStatus(): { connected: boolean; processed: number } {
    return {
      connected: this.emailReceiveService.isConnectedToImap(),
      processed: 0 // You can add a counter if needed
    };
  }

  /**
   * 获取今天的提醒状态
   */
  getTodayReminderStatus(userId: string = 'admin'): ReminderRecord | null {
    return this.reminderTracking.getReminderStatus(userId);
  }

  /**
   * 重置今天的提醒记录（用于测试）
   */
  async resetTodayReminders(userId: string = 'admin'): Promise<void> {
    await this.reminderTracking.resetTodayRecord(userId);
    logger.info(`Reset today's reminder records for user ${userId}`);
  }

  /**
   * 清理旧的提醒记录
   */
  async cleanupOldReminderRecords(): Promise<void> {
    await this.reminderTracking.cleanupOldRecords();
  }

  destroy(): void {
    if (this.morningTask) {
      this.morningTask.stop();
    }
    if (this.eveningTask) {
      this.eveningTask.stop();
    }
    if (this.weeklyTask) {
      this.weeklyTask.stop();
    }
    if (this.personalizationTask) {
      this.personalizationTask.stop();
    }
    this.emailReceiveService.stop();
    logger.info('Scheduler service destroyed');
  }
}

export default SchedulerService;