import cron from 'node-cron';
import config from '../config';
import logger from '../utils/logger';
import EmailService from './emailService';
import AIService from './aiService';
import ContextService from './contextService';
import ScheduleService from './scheduleService';

class SchedulerService {
  private emailService: EmailService;
  private aiService: AIService;
  private contextService: ContextService;
  private scheduleService: ScheduleService;
  private morningTask?: cron.ScheduledTask;
  private eveningTask?: cron.ScheduledTask;

  constructor() {
    this.emailService = new EmailService();
    this.aiService = new AIService();
    this.contextService = new ContextService();
    this.scheduleService = new ScheduleService();
  }

  async initialize(): Promise<void> {
    try {
      await this.contextService.initialize();
      await this.scheduleService.initialize();
      await this.emailService.verifyConnection();
      
      this.setupMorningReminder();
      this.setupEveningReminder();
      
      logger.info('Scheduler service initialized successfully');
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

    logger.info(`Morning reminder scheduled for ${config.schedule.morningReminderTime}`);
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

    logger.info(`Evening reminder scheduled for ${config.schedule.eveningReminderTime}`);
  }

  private async sendMorningReminder(): Promise<void> {
    try {
      logger.info('Starting morning reminder process...');
      
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
      
      await this.emailService.sendEveningReminder();
      
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

  async processWorkReport(workReport: string): Promise<void> {
    try {
      logger.info('Processing work report...');
      
      const recentContext = await this.contextService.getRecentContext(7);
      const summary = await this.aiService.summarizeWorkReport(workReport, recentContext);
      
      await this.emailService.sendWorkSummary(summary);
      
      await this.contextService.addEntry(
        'work_summary',
        `Work report processed: ${workReport}`,
        { summary }
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

  destroy(): void {
    if (this.morningTask) {
      this.morningTask.stop();
    }
    if (this.eveningTask) {
      this.eveningTask.stop();
    }
    logger.info('Scheduler service destroyed');
  }
}

export default SchedulerService;