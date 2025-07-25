import fs from 'fs/promises';
import path from 'path';
import logger from '../../utils/logger';
import { emailStatsCache } from '../system/cacheService';

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
      
      // 检查文件内容是否为空或无效
      if (!data.trim()) {
        logger.warn('Email records file is empty, initializing with empty array');
        this.records = [];
        await this.saveRecords();
        return;
      }
      
      let recordsData;
      try {
        recordsData = JSON.parse(data);
      } catch (parseError) {
        logger.error('Failed to parse email records JSON, reinitializing file:', parseError);
        this.records = [];
        await this.saveRecords();
        return;
      }
      
      // 确保数据是数组
      if (!Array.isArray(recordsData)) {
        logger.warn('Email records data is not an array, reinitializing');
        this.records = [];
        await this.saveRecords();
        return;
      }
      
      // 转换时间戳
      this.records = recordsData.map((record: Omit<EmailRecord, 'timestamp'> & { timestamp: string | Date }) => ({
        ...record,
        timestamp: new Date(record.timestamp)
      }));
      
      logger.debug(`Loaded ${this.records.length} email records`);
    } catch (error) {
      if ((error as { code?: string }).code === 'ENOENT') {
        // 文件不存在，创建空记录
        this.records = [];
        await this.saveRecords();
        logger.info('Created new email records file');
      } else {
        logger.error('Failed to load email records:', error);
        this.records = [];
        // 尝试备份损坏的文件并重新创建
        try {
          const backupPath = `${this.recordsFilePath}.backup.${Date.now()}`;
          await fs.rename(this.recordsFilePath, backupPath);
          logger.info(`Backed up corrupted file to ${backupPath}`);
        } catch (backupError) {
          logger.warn('Failed to backup corrupted file:', backupError);
        }
        await this.saveRecords();
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
    // Clean error message from non-printable characters that can break JSON parsing
    const cleanedData = { ...emailData };
    if (emailData.errorMessage) {
      cleanedData.errorMessage = this.sanitizeString(emailData.errorMessage);
    }
    
    const record: EmailRecord = {
      id: this.generateId(),
      timestamp: new Date(),
      ...cleanedData
    };

    this.records.push(record);

    // 保持记录数量在合理范围内（最多保留1000条）
    if (this.records.length > 1000) {
      this.records = this.records.slice(-1000);
    }

    await this.saveRecords();
    
    // 清除统计缓存，因为有新记录添加
    emailStatsCache.delete('email:stats:current');
    
    logger.debug(`Email record added: ${record.id} - ${record.subject}`);
  }

  /**
   * 获取邮件统计（带缓存）
   */
  getEmailStats(): EmailStats {
    const cacheKey = 'email:stats:current';
    
    // 检查缓存（5分钟有效期）
    const cached = emailStatsCache.get<EmailStats>(cacheKey);
    if (cached) {
      return cached;
    }

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

    const stats = {
      today: todayStats,
      thisWeek: weekStats,
      thisMonth: monthStats,
      recentRecords
    };

    // 缓存统计结果（5分钟）
    emailStatsCache.set(cacheKey, stats, 5 * 60 * 1000);
    
    return stats;
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

  /**
   * 清理字符串中的非法字符，防止JSON解析错误
   */
  private sanitizeString(str: string): string {
    // 移除有害的控制字符，但保留换行符(\n)、回车符(\r)和制表符(\t)
    return str.replace(/\p{Cc}/gu, (match) => {
      // 保留常用的空白字符
      return ['\n', '\r', '\t'].includes(match) ? match : '';
    });
  }
}

export default EmailStatsService;