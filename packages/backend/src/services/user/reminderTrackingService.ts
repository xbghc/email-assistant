import fs from 'fs/promises';
import path from 'path';
import logger from '../../utils/logger';
import ContextService from '../reports/contextService';

export interface ReminderRecord {
  userId: string;
  date: string; // YYYY-MM-DD
  morningReminderSent: boolean;
  eveningReminderSent: boolean;
  workReportReceived: boolean;
  lastMorningReminderTime?: string;
  lastEveningReminderTime?: string;
  lastWorkReportTime?: string;
}

interface ReminderTracking {
  [key: string]: ReminderRecord; // userId_date -> record
}

class ReminderTrackingService {
  private trackingFile: string;
  private tracking: ReminderTracking = {};
  private contextService: ContextService;

  constructor() {
    this.trackingFile = path.join(process.cwd(), 'data', 'reminder-tracking.json');
    this.contextService = new ContextService();
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

  /**
   * 标记晨间提醒已发送
   */
  async markMorningReminderSent(userId: string = 'admin'): Promise<void> {
    const today = this.getTodayString();
    const key = `${userId}_${today}`;
    const now = new Date().toISOString();

    if (!this.tracking[key]) {
      this.tracking[key] = {
        userId,
        date: today,
        morningReminderSent: false,
        eveningReminderSent: false,
        workReportReceived: false
      };
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
      this.tracking[key] = {
        userId,
        date: today,
        morningReminderSent: false,
        eveningReminderSent: false,
        workReportReceived: false
      };
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
      this.tracking[key] = {
        userId,
        date: today,
        morningReminderSent: false,
        eveningReminderSent: false,
        workReportReceived: false
      };
    }

    this.tracking[key].workReportReceived = true;
    this.tracking[key].lastWorkReportTime = now;

    await this.saveTracking();
    logger.debug(`Marked work report as received for user ${userId} on ${today}`);
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
    } catch (error: any) {
      if (error.code === 'ENOENT') {
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