import fs from 'fs/promises';
import path from 'path';
import logger from '../utils/logger';

export interface LogEntry {
  timestamp: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  meta?: Record<string, unknown>;
  source?: string;
}

export interface LogQuery {
  level?: 'error' | 'warn' | 'info' | 'debug' | 'all';
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  search?: string;
}

class LogReaderService {
  private logDirectory: string;
  private logFiles: string[];

  constructor() {
    this.logDirectory = path.join(process.cwd(), 'logs');
    this.logFiles = ['combined.log', 'error.log'];
  }

  async initialize(): Promise<void> {
    try {
      // 确保日志目录存在
      await fs.mkdir(this.logDirectory, { recursive: true });
      logger.info('Log reader service initialized');
    } catch (error) {
      logger.error('Failed to initialize log reader service:', error);
    }
  }

  /**
   * 读取日志文件
   */
  async readLogs(query: LogQuery = {}): Promise<LogEntry[]> {
    try {
      const { 
        level = 'all', 
        startDate, 
        endDate, 
        limit = 100, 
        search 
      } = query;

      let allEntries: LogEntry[] = [];

      // 读取所有日志文件
      for (const logFile of this.logFiles) {
        const filePath = path.join(this.logDirectory, logFile);
        
        try {
          const exists = await this.fileExists(filePath);
          if (!exists) {
            continue;
          }

          const content = await fs.readFile(filePath, 'utf-8');
          const entries = this.parseLogContent(content, logFile);
          allEntries = allEntries.concat(entries);
        } catch (error) {
          logger.warn(`Failed to read log file ${logFile}:`, error);
        }
      }

      // 按时间戳排序（最新的在前）
      allEntries.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      // 应用过滤器
      let filteredEntries = allEntries;

      // 按级别过滤
      if (level !== 'all') {
        filteredEntries = filteredEntries.filter(entry => entry.level === level);
      }

      // 按时间范围过滤
      if (startDate || endDate) {
        filteredEntries = filteredEntries.filter(entry => {
          const entryDate = new Date(entry.timestamp);
          if (startDate && entryDate < startDate) return false;
          if (endDate && entryDate > endDate) return false;
          return true;
        });
      }

      // 按搜索词过滤
      if (search) {
        const searchLower = search.toLowerCase();
        filteredEntries = filteredEntries.filter(entry => 
          entry.message.toLowerCase().includes(searchLower) ||
          (entry.meta && JSON.stringify(entry.meta).toLowerCase().includes(searchLower))
        );
      }

      // 限制数量
      return filteredEntries.slice(0, limit);

    } catch (error) {
      logger.error('Failed to read logs:', error);
      return [];
    }
  }

  /**
   * 解析日志内容
   */
  private parseLogContent(content: string, source: string): LogEntry[] {
    const entries: LogEntry[] = [];
    const lines = content.split('\n').filter(line => line.trim());

    for (const line of lines) {
      try {
        // 尝试解析JSON格式的日志
        const parsed = JSON.parse(line);
        
        entries.push({
          timestamp: parsed.timestamp || new Date().toISOString(),
          level: parsed.level || 'info',
          message: parsed.message || line,
          meta: parsed.meta || parsed,
          source
        });
      } catch {
        // 如果不是JSON格式，尝试解析文本格式
        const textEntry = this.parseTextLogLine(line, source);
        if (textEntry) {
          entries.push(textEntry);
        }
      }
    }

    return entries;
  }

  /**
   * 解析文本格式的日志行
   */
  private parseTextLogLine(line: string, source: string): LogEntry | null {
    // 匹配格式：[timestamp] level: message
    const textMatch = line.match(/^\[(.+?)\]\s+(\w+):\s+(.+)$/);
    if (textMatch) {
      const [, timestamp, level, message] = textMatch;
      return {
        timestamp: this.normalizeTimestamp(timestamp || ''),
        level: this.normalizeLevel(level || ''),
        message: (message || '').trim(),
        source
      };
    }

    // 匹配Winston默认格式：timestamp level message
    const winstonMatch = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z|\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\s+(\w+):\s+(.+)$/);
    if (winstonMatch) {
      const [, timestamp, level, message] = winstonMatch;
      return {
        timestamp: this.normalizeTimestamp(timestamp || ''),
        level: this.normalizeLevel(level || ''),
        message: (message || '').trim(),
        source
      };
    }

    // 如果无法解析格式，作为info级别日志处理
    if (line.trim()) {
      return {
        timestamp: new Date().toISOString(),
        level: 'info',
        message: line.trim(),
        source
      };
    }

    return null;
  }

  /**
   * 标准化时间戳格式
   */
  private normalizeTimestamp(timestamp: string): string {
    try {
      return new Date(timestamp).toISOString();
    } catch {
      return new Date().toISOString();
    }
  }

  /**
   * 标准化日志级别
   */
  private normalizeLevel(level: string): 'error' | 'warn' | 'info' | 'debug' {
    const normalized = level.toLowerCase();
    switch (normalized) {
      case 'error': return 'error';
      case 'warn': 
      case 'warning': return 'warn';
      case 'info': return 'info';
      case 'debug': return 'debug';
      default: return 'info';
    }
  }

  /**
   * 获取日志统计信息
   */
  async getLogStatistics(hours: number = 24): Promise<{
    total: number;
    byLevel: Record<string, number>;
    recentErrors: LogEntry[];
    timeRange: {
      start: string;
      end: string;
    };
  }> {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - hours * 60 * 60 * 1000);

      const logs = await this.readLogs({
        startDate,
        endDate,
        limit: 1000
      });

      const byLevel = logs.reduce((acc, log) => {
        acc[log.level] = (acc[log.level] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const recentErrors = logs
        .filter(log => log.level === 'error')
        .slice(0, 5);

      return {
        total: logs.length,
        byLevel,
        recentErrors,
        timeRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        }
      };
    } catch (error) {
      logger.error('Failed to get log statistics:', error);
      return {
        total: 0,
        byLevel: {},
        recentErrors: [],
        timeRange: {
          start: new Date().toISOString(),
          end: new Date().toISOString()
        }
      };
    }
  }

  /**
   * 获取日志文件信息
   */
  async getLogFileInfo(): Promise<Array<{
    name: string;
    size: number;
    lastModified: Date;
    exists: boolean;
  }>> {
    const fileInfos = [];

    for (const logFile of this.logFiles) {
      const filePath = path.join(this.logDirectory, logFile);
      
      try {
        const stats = await fs.stat(filePath);
        fileInfos.push({
          name: logFile,
          size: stats.size,
          lastModified: stats.mtime,
          exists: true
        });
      } catch {
        fileInfos.push({
          name: logFile,
          size: 0,
          lastModified: new Date(),
          exists: false
        });
      }
    }

    return fileInfos;
  }

  /**
   * 清理旧日志文件
   */
  async cleanupOldLogs(days: number = 30): Promise<{ cleaned: number; totalSize: number }> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      let cleanedCount = 0;
      let totalSize = 0;

      // 清理旋转的日志文件（如 combined.log.1, combined.log.2 等）
      const files = await fs.readdir(this.logDirectory);
      
      for (const file of files) {
        if (file.match(/\.(log\.\d+|old)$/)) {
          const filePath = path.join(this.logDirectory, file);
          
          try {
            const stats = await fs.stat(filePath);
            
            if (stats.mtime < cutoffDate) {
              totalSize += stats.size;
              await fs.unlink(filePath);
              cleanedCount++;
              logger.info(`Cleaned up old log file: ${file}`);
            }
          } catch (error) {
            logger.warn(`Failed to clean up log file ${file}:`, error);
          }
        }
      }

      return { cleaned: cleanedCount, totalSize };
    } catch (error) {
      logger.error('Failed to cleanup old logs:', error);
      return { cleaned: 0, totalSize: 0 };
    }
  }

  /**
   * 导出日志为CSV格式
   */
  async exportLogsAsCSV(query: LogQuery = {}): Promise<string> {
    try {
      const logs = await this.readLogs({ ...query, limit: 10000 });
      
      const csvLines = ['Timestamp,Level,Message,Source'];
      
      for (const log of logs) {
        const message = log.message.replace(/"/g, '""'); // 转义双引号
        csvLines.push(`"${log.timestamp}","${log.level}","${message}","${log.source || ''}"`);
      }

      return csvLines.join('\n');
    } catch (error) {
      logger.error('Failed to export logs as CSV:', error);
      return '';
    }
  }

  /**
   * 检查文件是否存在
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 实时监控错误日志
   */
  async getRecentErrors(minutes: number = 60): Promise<LogEntry[]> {
    const startDate = new Date(Date.now() - minutes * 60 * 1000);
    
    return this.readLogs({
      level: 'error',
      startDate,
      limit: 50
    });
  }

  /**
   * 获取系统健康指标（基于日志）
   */
  async getSystemHealthFromLogs(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    errors: number;
    warnings: number;
    lastError?: LogEntry;
    issues: string[];
  }> {
    try {
      const stats = await this.getLogStatistics(1); // 最近1小时
      const errors = stats.byLevel.error || 0;
      const warnings = stats.byLevel.warn || 0;
      
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      const issues: string[] = [];

      if (errors > 10) {
        status = 'critical';
        issues.push(`High error rate: ${errors} errors in the last hour`);
      } else if (errors > 3 || warnings > 20) {
        status = 'warning';
        if (errors > 3) issues.push(`Elevated error rate: ${errors} errors`);
        if (warnings > 20) issues.push(`High warning rate: ${warnings} warnings`);
      }

      return {
        status,
        errors,
        warnings,
        ...(stats.recentErrors[0] && { lastError: stats.recentErrors[0] }),
        issues
      };
    } catch (error) {
      logger.error('Failed to get system health from logs:', error);
      return {
        status: 'critical',
        errors: -1,
        warnings: -1,
        issues: ['Failed to read logs']
      };
    }
  }
}

export default LogReaderService;