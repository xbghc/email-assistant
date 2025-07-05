import fs from 'fs/promises';
import path from 'path';
import logger from '../utils/logger';

export interface EmailRecord {
  id: string;
  timestamp: Date;
  to: string;
  subject: string;
  type: 'reminder' | 'report' | 'suggestion' | 'system' | 'admin';
  status: 'sent' | 'failed';
  errorMessage?: string;
  userId?: string;
}

export interface EmailStats {
  today: {
    total: number;
    sent: number;
    failed: number;
    byType: Record<string, number>;
  };
  thisWeek: {
    total: number;
    sent: number;
    failed: number;
  };
  thisMonth: {
    total: number;
    sent: number;
    failed: number;
  };
  recentRecords: EmailRecord[];
}

class EmailStatsService {
  private recordsFilePath: string;
  private records: EmailRecord[] = [];

  constructor() {
    this.recordsFilePath = path.join(process.cwd(), 'data', 'email-records.json');
  }

  async initialize(): Promise<void> {
    try {
      // 确保数据目录存在
      const dataDir = path.dirname(this.recordsFilePath);
      await fs.mkdir(dataDir, { recursive: true });

      // 加载现有记录
      await this.loadRecords();
      
      logger.info('Email stats service initialized');
    } catch (error) {
      logger.error('Failed to initialize email stats service:', error);
    }
  }

  /**
   * 加载邮件记录
   */
  private async loadRecords(): Promise<void> {
    try {
      const data = await fs.readFile(this.recordsFilePath, 'utf-8');
      const recordsData = JSON.parse(data);
      
      // 转换时间戳
      this.records = recordsData.map((record: any) => ({
        ...record,
        timestamp: new Date(record.timestamp)
      }));
      
      logger.debug(`Loaded ${this.records.length} email records`);
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        // 文件不存在，创建空记录
        this.records = [];
        await this.saveRecords();
        logger.info('Created new email records file');
      } else {
        logger.error('Failed to load email records:', error);
        this.records = [];
      }
    }
  }

  /**
   * 保存邮件记录
   */
  private async saveRecords(): Promise<void> {
    try {
      await fs.writeFile(this.recordsFilePath, JSON.stringify(this.records, null, 2));
      logger.debug('Email records saved successfully');
    } catch (error) {
      logger.error('Failed to save email records:', error);
    }
  }

  /**
   * 记录邮件发送
   */
  async recordEmailSent(emailData: {
    to: string;
    subject: string;
    type: EmailRecord['type'];
    status: EmailRecord['status'];
    errorMessage?: string;
    userId?: string;
  }): Promise<void> {
    const record: EmailRecord = {
      id: this.generateId(),
      timestamp: new Date(),
      ...emailData
    };

    this.records.push(record);

    // 保持记录数量在合理范围内（最多保留1000条）
    if (this.records.length > 1000) {
      this.records = this.records.slice(-1000);
    }

    await this.saveRecords();
    logger.debug(`Email record added: ${record.id} - ${record.subject}`);
  }

  /**
   * 获取邮件统计
   */
  getEmailStats(): EmailStats {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(todayStart.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // 今日统计
    const todayRecords = this.records.filter(r => r.timestamp >= todayStart);
    const todayStats = {
      total: todayRecords.length,
      sent: todayRecords.filter(r => r.status === 'sent').length,
      failed: todayRecords.filter(r => r.status === 'failed').length,
      byType: this.groupByType(todayRecords)
    };

    // 本周统计
    const weekRecords = this.records.filter(r => r.timestamp >= weekStart);
    const weekStats = {
      total: weekRecords.length,
      sent: weekRecords.filter(r => r.status === 'sent').length,
      failed: weekRecords.filter(r => r.status === 'failed').length
    };

    // 本月统计
    const monthRecords = this.records.filter(r => r.timestamp >= monthStart);
    const monthStats = {
      total: monthRecords.length,
      sent: monthRecords.filter(r => r.status === 'sent').length,
      failed: monthRecords.filter(r => r.status === 'failed').length
    };

    // 最近记录（最新10条）
    const recentRecords = [...this.records]
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10);

    return {
      today: todayStats,
      thisWeek: weekStats,
      thisMonth: monthStats,
      recentRecords
    };
  }

  /**
   * 按类型分组统计
   */
  private groupByType(records: EmailRecord[]): Record<string, number> {
    return records.reduce((acc, record) => {
      acc[record.type] = (acc[record.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * 获取指定日期范围的统计
   */
  getStatsForDateRange(startDate: Date, endDate: Date): {
    total: number;
    sent: number;
    failed: number;
    byType: Record<string, number>;
    records: EmailRecord[];
  } {
    const rangeRecords = this.records.filter(r => 
      r.timestamp >= startDate && r.timestamp <= endDate
    );

    return {
      total: rangeRecords.length,
      sent: rangeRecords.filter(r => r.status === 'sent').length,
      failed: rangeRecords.filter(r => r.status === 'failed').length,
      byType: this.groupByType(rangeRecords),
      records: rangeRecords
    };
  }

  /**
   * 清理旧记录（保留指定天数的记录）
   */
  async cleanOldRecords(keepDays: number = 30): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - keepDays);

    const originalCount = this.records.length;
    this.records = this.records.filter(r => r.timestamp >= cutoffDate);
    
    if (this.records.length !== originalCount) {
      await this.saveRecords();
      const removedCount = originalCount - this.records.length;
      logger.info(`Cleaned ${removedCount} old email records (older than ${keepDays} days)`);
    }
  }

  /**
   * 获取邮件发送趋势数据（用于图表）
   */
  getEmailTrendData(days: number = 7): Array<{
    date: string;
    sent: number;
    failed: number;
  }> {
    const trends: Array<{ date: string; sent: number; failed: number }> = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(now.getDate() - i);
      const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dateEnd = new Date(dateStart);
      dateEnd.setDate(dateStart.getDate() + 1);

      const dayRecords = this.records.filter(r => 
        r.timestamp >= dateStart && r.timestamp < dateEnd
      );

      trends.push({
        date: date.toISOString().split('T')[0]!,
        sent: dayRecords.filter(r => r.status === 'sent').length,
        failed: dayRecords.filter(r => r.status === 'failed').length
      });
    }

    return trends;
  }
}

export default EmailStatsService;