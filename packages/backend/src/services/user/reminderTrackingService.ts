import fs from 'fs/promises';
import path from 'path';
import logger from '../../utils/logger';
import ContextService from '../reports/contextService';
import EmailContentAnalyzer from '../email/emailContentAnalyzer';
import { ParsedEmail } from '../email/emailReceiveService';
import { 
  eventBus, 
  publishEvent, 
  createEventMetadata,
  ReminderDetectedEvent,
  EVENT_TYPES
} from '../../events/eventTypes';

export interface ReminderRecord {
  userId: string;
  date: string; // YYYY-MM-DD
  morningReminderSent: boolean;
  eveningReminderSent: boolean;
  workReportReceived: boolean;
  scheduleRequested: boolean;
  lastMorningReminderTime?: string;
  lastEveningReminderTime?: string;
  lastWorkReportTime?: string;
  lastScheduleRequestTime?: string;
  skipReasons?: {
    morningSkipReason?: string;
    eveningSkipReason?: string;
  };
}

interface ReminderTracking {
  [key: string]: ReminderRecord; // userId_date -> record
}

class ReminderTrackingService {
  private trackingFile: string;
  private tracking: ReminderTracking = {};
  private contextService: ContextService;
  private contentAnalyzer: EmailContentAnalyzer;

  constructor() {
    this.trackingFile = path.join(process.cwd(), 'data', 'reminder-tracking.json');
    this.contextService = new ContextService();
    this.contentAnalyzer = new EmailContentAnalyzer();
    
    // 设置事件监听器
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // 监听邮件处理事件，检测提醒相关内容
    eventBus.on(EVENT_TYPES.EMAIL_PROCESSED, async (event) => {
      try {
        if (event.payload.hasReminder) {
          // 发布提醒检测事件
          const reminderDetectedEvent: ReminderDetectedEvent = {
            type: EVENT_TYPES.REMINDER_DETECTED,
            metadata: createEventMetadata('ReminderTrackingService', event.metadata.correlationId, event.payload.userId),
            payload: {
              messageId: event.payload.messageId,
              userId: event.payload.userId,
              reminderText: event.payload.aiResponse,
              confidence: 0.8,
            }
          };
          
          publishEvent(reminderDetectedEvent);
        }
      } catch (error) {
        logger.error('Failed to process email processed event in reminder tracking:', error);
      }
    });
  }

  async initialize(): Promise<void> {
    try {
      await this.ensureDataDirectory();
      await this.loadTracking();
      logger.debug('Reminder tracking service initialized');
    } catch (error) {
      logger.error('Failed to initialize reminder tracking service:', error);
      throw error;
    }
  }

  /**
   * 检查是否应该发送晨间提醒
   */
  async shouldSendMorningReminder(userId: string = 'admin'): Promise<boolean> {
    const today = this.getTodayString();
    const key = `${userId}_${today}`;
    const record = this.tracking[key];

    // 如果今天还没有记录，可以发送
    if (!record) {
      return true;
    }

    // 如果已经发送过晨间提醒，不再发送
    if (record.morningReminderSent) {
      logger.info(`Morning reminder already sent today for user ${userId}`);
      return false;
    }

    // 检查是否有智能跳过的理由
    if (record.skipReasons?.morningSkipReason) {
      logger.info(`Skipping morning reminder for user ${userId}: ${record.skipReasons.morningSkipReason}`);
      return false;
    }

    // 如果用户已经发送了日程安排请求，跳过晨间提醒
    if (record.scheduleRequested) {
      logger.info(`User ${userId} already requested schedule today, skipping morning reminder`);
      return false;
    }

    return true;
  }

  /**
   * 检查是否应该发送晚间提醒
   */
  async shouldSendEveningReminder(userId: string = 'admin'): Promise<boolean> {
    const today = this.getTodayString();
    const key = `${userId}_${today}`;
    const record = this.tracking[key];

    // 如果今天还没有记录，可以发送
    if (!record) {
      return true;
    }

    // 如果已经发送过晚间提醒，不再发送
    if (record.eveningReminderSent) {
      logger.info(`Evening reminder already sent today for user ${userId}`);
      return false;
    }

    // 检查是否有智能跳过的理由
    if (record.skipReasons?.eveningSkipReason) {
      logger.info(`Skipping evening reminder for user ${userId}: ${record.skipReasons.eveningSkipReason}`);
      return false;
    }

    // 如果用户已经提交了工作报告，不需要发送晚间提醒
    if (record && record.workReportReceived) {
      logger.info(`Work report already received today for user ${userId}, skipping evening reminder`);
      return false;
    }

    // 检查上下文中是否有今天的工作总结
    const hasWorkReportToday = await this.checkWorkReportInContext(userId, today);
    if (hasWorkReportToday) {
      // 更新记录
      await this.markWorkReportReceived(userId);
      logger.info(`Work report found in context for user ${userId}, skipping evening reminder`);
      return false;
    }

    return true;
  }

  private createEmptyRecord(userId: string, date: string): ReminderRecord {
    return {
      userId,
      date,
      morningReminderSent: false,
      eveningReminderSent: false,
      workReportReceived: false,
      scheduleRequested: false
    };
  }

  /**
   * 标记晨间提醒已发送
   */
  async markMorningReminderSent(userId: string = 'admin'): Promise<void> {
    const today = this.getTodayString();
    const key = `${userId}_${today}`;
    const now = new Date().toISOString();

    if (!this.tracking[key]) {
      this.tracking[key] = this.createEmptyRecord(userId, today);
    }

    this.tracking[key].morningReminderSent = true;
    this.tracking[key].lastMorningReminderTime = now;

    await this.saveTracking();
    logger.debug(`Marked morning reminder as sent for user ${userId} on ${today}`);
  }

  /**
   * 标记晚间提醒已发送
   */
  async markEveningReminderSent(userId: string = 'admin'): Promise<void> {
    const today = this.getTodayString();
    const key = `${userId}_${today}`;
    const now = new Date().toISOString();

    if (!this.tracking[key]) {
      this.tracking[key] = this.createEmptyRecord(userId, today);
    }

    this.tracking[key].eveningReminderSent = true;
    this.tracking[key].lastEveningReminderTime = now;

    await this.saveTracking();
    logger.debug(`Marked evening reminder as sent for user ${userId} on ${today}`);
  }

  /**
   * 标记工作报告已接收
   */
  async markWorkReportReceived(userId: string = 'admin'): Promise<void> {
    const today = this.getTodayString();
    const key = `${userId}_${today}`;
    const now = new Date().toISOString();

    if (!this.tracking[key]) {
      this.tracking[key] = this.createEmptyRecord(userId, today);
    }

    this.tracking[key].workReportReceived = true;
    this.tracking[key].lastWorkReportTime = now;

    await this.saveTracking();
    logger.debug(`Marked work report as received for user ${userId} on ${today}`);
  }

  /**
   * 标记日程安排请求已接收
   */
  async markScheduleRequested(userId: string = 'admin'): Promise<void> {
    const today = this.getTodayString();
    const key = `${userId}_${today}`;
    const now = new Date().toISOString();

    if (!this.tracking[key]) {
      this.tracking[key] = this.createEmptyRecord(userId, today);
    }

    this.tracking[key].scheduleRequested = true;
    this.tracking[key].lastScheduleRequestTime = now;

    await this.saveTracking();
    logger.debug(`Marked schedule request as received for user ${userId} on ${today}`);
  }

  /**
   * 智能分析邮件内容并更新提醒状态
   */
  async analyzeEmailAndUpdateReminders(email: ParsedEmail, userId: string = 'admin'): Promise<void> {
    try {
      // 使用智能内容分析器分析邮件
      const skipRecommendation = await this.contentAnalyzer.analyzeForReminderSkip(email);
      
      if (skipRecommendation.confidence > 0.6) {
        const today = this.getTodayString();
        const key = `${userId}_${today}`;
        
        // 确保记录存在
        if (!this.tracking[key]) {
          this.tracking[key] = {
            userId,
            date: today,
            morningReminderSent: false,
            eveningReminderSent: false,
            workReportReceived: false,
            scheduleRequested: false
          };
        }
        
        // 更新跳过理由
        if (!this.tracking[key].skipReasons) {
          this.tracking[key].skipReasons = {};
        }
        
        if (skipRecommendation.shouldSkipMorningReminder) {
          this.tracking[key].skipReasons!.morningSkipReason = skipRecommendation.reason;
          logger.info(`Set morning reminder skip reason for user ${userId}: ${skipRecommendation.reason}`);
        }
        
        if (skipRecommendation.shouldSkipEveningReminder) {
          this.tracking[key].skipReasons!.eveningSkipReason = skipRecommendation.reason;
          logger.info(`Set evening reminder skip reason for user ${userId}: ${skipRecommendation.reason}`);
        }
        
        // 同时分析内容类型并更新状态
        const contentAnalysis = await this.contentAnalyzer.analyzeContent(email);
        
        if (contentAnalysis.isWorkReport && contentAnalysis.confidence > 0.7) {
          await this.markWorkReportReceived(userId);
          logger.info(`Detected work report from user ${userId}, marked as received`);
        }
        
        if (contentAnalysis.isScheduleRequest && contentAnalysis.confidence > 0.7) {
          await this.markScheduleRequested(userId);
          logger.info(`Detected schedule request from user ${userId}, marked as requested`);
        }
        
        await this.saveTracking();
      }
    } catch (error) {
      logger.error('Failed to analyze email and update reminders:', error);
    }
  }

  /**
   * 检查上下文中是否有今天的工作报告
   */
  private async checkWorkReportInContext(userId: string, date: string): Promise<boolean> {
    try {
      const recentEntries = await this.contextService.getRecentContext(10, userId);
      const today = new Date(date);
      const todayStart = new Date(today);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(today);
      todayEnd.setHours(23, 59, 59, 999);

      // 查找今天的工作总结
      const todayWorkReports = recentEntries.filter(entry => 
        entry.type === 'work_summary' &&
        entry.timestamp >= todayStart &&
        entry.timestamp <= todayEnd
      );

      return todayWorkReports.length > 0;
    } catch (error) {
      logger.error('Failed to check work report in context:', error);
      return false;
    }
  }

  /**
   * 获取用户今天的提醒状态
   */
  getReminderStatus(userId: string = 'admin'): ReminderRecord | null {
    const today = this.getTodayString();
    const key = `${userId}_${today}`;
    return this.tracking[key] || null;
  }

  /**
   * 清理旧记录（保留最近30天）
   */
  async cleanupOldRecords(): Promise<void> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = this.formatDate(thirtyDaysAgo);

    let removedCount = 0;
    for (const key in this.tracking) {
      const record = this.tracking[key];
      if (record && record.date < cutoffDate) {
        delete this.tracking[key];
        removedCount++;
      }
    }

    if (removedCount > 0) {
      await this.saveTracking();
      logger.info(`Cleaned up ${removedCount} old reminder tracking records`);
    }
  }

  /**
   * 重置用户今天的记录（用于测试）
   */
  async resetTodayRecord(userId: string = 'admin'): Promise<void> {
    const today = this.getTodayString();
    const key = `${userId}_${today}`;
    
    if (this.tracking[key]) {
      delete this.tracking[key];
      await this.saveTracking();
      logger.info(`Reset today's reminder record for user ${userId}`);
    }
  }

  private getTodayString(): string {
    return this.formatDate(new Date());
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0] || ''; // YYYY-MM-DD
  }

  private async ensureDataDirectory(): Promise<void> {
    const dataDir = path.dirname(this.trackingFile);
    try {
      await fs.access(dataDir);
    } catch {
      await fs.mkdir(dataDir, { recursive: true });
    }
  }

  private async loadTracking(): Promise<void> {
    try {
      const data = await fs.readFile(this.trackingFile, 'utf-8');
      this.tracking = JSON.parse(data);
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        // 文件不存在，创建新的
        this.tracking = {};
        await this.saveTracking();
      } else {
        throw error;
      }
    }
  }

  private async saveTracking(): Promise<void> {
    try {
      await fs.writeFile(this.trackingFile, JSON.stringify(this.tracking, null, 2), 'utf-8');
    } catch (error) {
      logger.error('Failed to save reminder tracking:', error);
      throw error;
    }
  }
}

export default ReminderTrackingService;