import fs from 'fs/promises';
import path from 'path';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { createReadStream, createWriteStream } from 'fs';
import logger from '../utils/logger';

export interface LogRotationConfig {
  maxFileSize: number; // 字节
  maxFiles: number; // 保留的最大文件数
  compressOldFiles: boolean; // 是否压缩旧文件
  rotationInterval: 'daily' | 'weekly' | 'size-based'; // 轮转策略
  logDirectory: string; // 日志目录
}

interface LogFileInfo {
  name: string;
  path: string;
  size: number;
  modifiedTime: Date;
  isCompressed: boolean;
}

/**
 * 日志轮转和归档服务
 */
export class LogRotationService {
  private config: LogRotationConfig;
  private rotationTimer?: NodeJS.Timeout | undefined;

  constructor(config?: Partial<LogRotationConfig>) {
    this.config = {
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 10,
      compressOldFiles: true,
      rotationInterval: 'daily',
      logDirectory: path.join(process.cwd(), 'logs'),
      ...config
    };
  }

  /**
   * 初始化日志轮转服务
   */
  async initialize(): Promise<void> {
    try {
      // 确保日志目录存在
      await fs.mkdir(this.config.logDirectory, { recursive: true });
      
      // 初始检查和清理
      await this.checkAndRotateLogs();
      
      // 设置定时轮转
      this.scheduleRotation();
      
      logger.info('日志轮转服务已启动', {
        maxFileSize: this.formatBytes(this.config.maxFileSize),
        maxFiles: this.config.maxFiles,
        interval: this.config.rotationInterval,
        logDirectory: this.config.logDirectory
      });
    } catch (error) {
      logger.error('日志轮转服务初始化失败:', error);
      throw error;
    }
  }

  /**
   * 检查并执行日志轮转
   */
  async checkAndRotateLogs(): Promise<void> {
    try {
      const logFiles = await this.getLogFiles();
      
      for (const logFile of logFiles) {
        if (await this.shouldRotateFile(logFile)) {
          await this.rotateLogFile(logFile);
        }
      }
      
      // 清理过期文件
      await this.cleanupOldFiles();
      
    } catch (error) {
      logger.error('日志轮转检查失败:', error);
    }
  }

  /**
   * 获取所有日志文件
   */
  private async getLogFiles(): Promise<LogFileInfo[]> {
    const files: LogFileInfo[] = [];
    
    try {
      const entries = await fs.readdir(this.config.logDirectory);
      
      for (const entry of entries) {
        const filePath = path.join(this.config.logDirectory, entry);
        const stats = await fs.stat(filePath);
        
        if (stats.isFile() && this.isLogFile(entry)) {
          files.push({
            name: entry,
            path: filePath,
            size: stats.size,
            modifiedTime: stats.mtime,
            isCompressed: entry.endsWith('.gz')
          });
        }
      }
      
      return files.sort((a, b) => b.modifiedTime.getTime() - a.modifiedTime.getTime());
    } catch (error) {
      logger.error('获取日志文件列表失败:', error);
      return [];
    }
  }

  /**
   * 判断是否为日志文件
   */
  private isLogFile(filename: string): boolean {
    const logExtensions = ['.log', '.log.gz'];
    return logExtensions.some(ext => filename.endsWith(ext));
  }

  /**
   * 判断文件是否需要轮转
   */
  private async shouldRotateFile(logFile: LogFileInfo): Promise<boolean> {
    // 已压缩的文件不需要轮转
    if (logFile.isCompressed) {
      return false;
    }

    // 基于文件大小的轮转
    if (this.config.rotationInterval === 'size-based') {
      return logFile.size >= this.config.maxFileSize;
    }

    // 基于时间的轮转
    const now = new Date();
    const fileDate = logFile.modifiedTime;

    switch (this.config.rotationInterval) {
      case 'daily':
        return now.toDateString() !== fileDate.toDateString();
      
      case 'weekly': {
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
        return fileDate < weekStart;
      }
      
      default:
        return false;
    }
  }

  /**
   * 轮转日志文件
   */
  private async rotateLogFile(logFile: LogFileInfo): Promise<void> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const baseName = path.parse(logFile.name).name;
      const rotatedName = `${baseName}-${timestamp}.log`;
      const rotatedPath = path.join(this.config.logDirectory, rotatedName);

      // 移动文件
      await fs.rename(logFile.path, rotatedPath);
      
      // 压缩文件（如果启用）
      if (this.config.compressOldFiles) {
        await this.compressFile(rotatedPath);
        await fs.unlink(rotatedPath); // 删除未压缩的原文件
      }

      logger.info('日志文件已轮转', {
        original: logFile.name,
        rotated: rotatedName,
        compressed: this.config.compressOldFiles,
        size: this.formatBytes(logFile.size)
      });

    } catch (error) {
      logger.error('日志文件轮转失败:', error);
    }
  }

  /**
   * 压缩文件
   */
  private async compressFile(filePath: string): Promise<void> {
    const compressedPath = `${filePath}.gz`;
    
    try {
      const readStream = createReadStream(filePath);
      const writeStream = createWriteStream(compressedPath);
      const gzipStream = createGzip();

      await pipeline(readStream, gzipStream, writeStream);
      
      logger.debug('文件压缩完成', {
        original: filePath,
        compressed: compressedPath
      });

    } catch (error) {
      logger.error('文件压缩失败:', error);
      throw error;
    }
  }

  /**
   * 清理过期文件
   */
  private async cleanupOldFiles(): Promise<void> {
    try {
      const logFiles = await this.getLogFiles();
      
      // 按修改时间排序，保留最新的 maxFiles 个
      const filesToDelete = logFiles.slice(this.config.maxFiles);

      for (const file of filesToDelete) {
        await fs.unlink(file.path);
        logger.info('已删除过期日志文件', {
          filename: file.name,
          age: this.formatDuration(Date.now() - file.modifiedTime.getTime()),
          size: this.formatBytes(file.size)
        });
      }

      if (filesToDelete.length > 0) {
        logger.info('清理完成', {
          deletedFiles: filesToDelete.length,
          remainingFiles: logFiles.length - filesToDelete.length
        });
      }

    } catch (error) {
      logger.error('清理过期文件失败:', error);
    }
  }

  /**
   * 设置定时轮转
   */
  private scheduleRotation(): void {
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
    }

    let interval: number;

    switch (this.config.rotationInterval) {
      case 'daily':
        interval = 24 * 60 * 60 * 1000; // 24小时
        break;
      case 'weekly':
        interval = 7 * 24 * 60 * 60 * 1000; // 7天
        break;
      case 'size-based':
        interval = 60 * 60 * 1000; // 1小时检查一次
        break;
      default:
        interval = 24 * 60 * 60 * 1000;
    }

    this.rotationTimer = setInterval(() => {
      this.checkAndRotateLogs();
    }, interval);
  }

  /**
   * 手动触发日志轮转
   */
  async forceRotation(): Promise<void> {
    logger.info('手动触发日志轮转');
    await this.checkAndRotateLogs();
  }

  /**
   * 获取日志统计信息
   */
  async getLogStatistics(): Promise<Record<string, unknown>> {
    try {
      const logFiles = await this.getLogFiles();
      
      const stats = {
        totalFiles: logFiles.length,
        totalSize: logFiles.reduce((sum, file) => sum + file.size, 0),
        compressedFiles: logFiles.filter(f => f.isCompressed).length,
        oldestFile: logFiles.length > 0 ? logFiles[logFiles.length - 1]?.modifiedTime : null,
        newestFile: logFiles.length > 0 ? logFiles[0]?.modifiedTime : null,
        files: logFiles.map(file => ({
          name: file.name,
          size: this.formatBytes(file.size),
          modified: file.modifiedTime.toISOString(),
          compressed: file.isCompressed
        }))
      };

      return {
        ...stats,
        totalSizeFormatted: this.formatBytes(stats.totalSize)
      };

    } catch (error) {
      logger.error('获取日志统计失败:', error);
      return {};
    }
  }

  /**
   * 导出日志归档
   */
  async exportLogArchive(startDate?: Date, endDate?: Date): Promise<string> {
    try {
      const logFiles = await this.getLogFiles();
      
      // 过滤日期范围
      const filteredFiles = logFiles.filter(file => {
        if (startDate && file.modifiedTime < startDate) return false;
        if (endDate && file.modifiedTime > endDate) return false;
        return true;
      });

      // 创建归档目录
      const archiveDir = path.join(this.config.logDirectory, 'archives');
      await fs.mkdir(archiveDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const archivePath = path.join(archiveDir, `log-archive-${timestamp}.tar.gz`);

      // 这里应该使用 tar 命令创建归档，简化起见返回文件列表
      const archiveManifest = {
        createdAt: new Date().toISOString(),
        files: filteredFiles.map(f => f.name),
        totalSize: this.formatBytes(filteredFiles.reduce((sum, f) => sum + f.size, 0))
      };

      await fs.writeFile(
        archivePath.replace('.tar.gz', '.json'),
        JSON.stringify(archiveManifest, null, 2)
      );

      logger.info('日志归档已创建', {
        archivePath,
        fileCount: filteredFiles.length,
        totalSize: archiveManifest.totalSize
      });

      return archivePath;

    } catch (error) {
      logger.error('导出日志归档失败:', error);
      throw error;
    }
  }

  /**
   * 停止日志轮转服务
   */
  stop(): void {
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
      this.rotationTimer = undefined;
    }
    logger.info('日志轮转服务已停止');
  }

  /**
   * 格式化字节数
   */
  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * 格式化时间间隔
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}天`;
    if (hours > 0) return `${hours}小时`;
    if (minutes > 0) return `${minutes}分钟`;
    return `${seconds}秒`;
  }
}

export default LogRotationService;