import path from 'path';
import fs from 'fs/promises';
import { ContextEntry, RawContextEntry } from '../../models/index';
import config from '../../config/index';
import logger from '../../utils/logger';
import AIService from '../ai/aiService';
import { safeReadJsonFile, safeWriteJsonFile, withFileLock } from '../../utils/fileUtils';

class ContextService {
  private contextFile: string;
  private context: Map<string, ContextEntry[]> = new Map(); // 用户ID -> 上下文数组
  private aiService: AIService;
  private saveTimer: NodeJS.Timeout | null = null;

  constructor(contextFile?: string) {
    if (contextFile) {
      this.contextFile = contextFile;
    } else {
      // 基于脚本文件位置确定后端根目录
      const scriptPath = process.argv[1] || process.cwd();
      const scriptDir = path.dirname(scriptPath);
      const backendRoot = path.resolve(scriptDir, '../../../'); // 从 src/services/reports 到 packages/backend
      this.contextFile = path.join(backendRoot, 'data/context.json');
    }
    this.aiService = new AIService();
  }

  async initialize(): Promise<void> {
    try {
      await this.ensureDataDirectory();
      await this.loadContext();
      // Context service initialized silently
    } catch (error) {
      logger.error('Failed to initialize context service:', error);
      throw error;
    }
  }

  async addEntry(type: ContextEntry['type'], content: string, metadata?: Record<string, unknown>, userId = 'admin'): Promise<void> {
    const entry: ContextEntry = {
      id: this.generateId(),
      timestamp: new Date(),
      type,
      content,
      metadata,
    };

    if (!this.context.has(userId)) {
      this.context.set(userId, []);
    }
    const userContext = this.context.get(userId);
    if (userContext) {
      userContext.push(entry);
    }
    // 使用防抖保存，减少频繁文件写入
    this.saveContextDebounced();
    
    if (this.shouldCompress(userId)) {
      await this.compressContext(userId);
    }

    logger.debug(`Context entry added: ${type}`);
  }

  async getContext(limit?: number, userId = 'admin'): Promise<ContextEntry[]> {
    const userContext = this.context.get(userId) || [];
    return limit ? userContext.slice(-limit) : userContext;
  }

  async getContextByType(type: ContextEntry['type'], limit?: number, userId = 'admin'): Promise<ContextEntry[]> {
    const userContext = this.context.get(userId) || [];
    const filtered = userContext.filter(entry => entry.type === type);
    return limit ? filtered.slice(-limit) : filtered;
  }

  async getRecentContext(days: number = 7, userId = 'admin'): Promise<ContextEntry[]> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    
    const userContext = this.context.get(userId) || [];
    return userContext.filter(entry => entry.timestamp >= cutoff);
  }

  private async ensureDataDirectory(): Promise<void> {
    const dataDir = path.dirname(this.contextFile);
    try {
      await fs.access(dataDir);
    } catch {
      await fs.mkdir(dataDir, { recursive: true });
    }
  }

  private async loadContext(): Promise<void> {
    try {
      const parsed = await safeReadJsonFile<Record<string, RawContextEntry[]> | RawContextEntry[]>(this.contextFile, {});
      
      this.context.clear();
      if (Array.isArray(parsed)) {
        // 兼容旧格式：直接是数组，转换为admin用户的上下文
        const entries = parsed.map((entry: RawContextEntry): ContextEntry => ({
          ...entry,
          timestamp: new Date(entry.timestamp),
        }));
        this.context.set('admin', entries);
      } else {
        // 新格式：用户ID -> 上下文数组的映射
        for (const [userId, entries] of Object.entries(parsed)) {
          if (Array.isArray(entries)) {
            const userEntries = entries.map((entry: RawContextEntry): ContextEntry => ({
              ...entry,
              timestamp: new Date(entry.timestamp),
            }));
            this.context.set(userId, userEntries);
          }
        }
      }
    } catch (error) {
      logger.error('Failed to load context:', error);
      this.context.clear();
      await this.saveContextImmediate();
    }
  }


  private shouldCompress(userId: string): boolean {
    const userContext = this.context.get(userId) || [];
    const totalLength = userContext.reduce((sum, entry) => sum + entry.content.length, 0);
    return totalLength > config.context.compressionThreshold;
  }

  private async compressContext(userId: string): Promise<void> {
    try {
      logger.debug(`Starting context compression for user ${userId}...`);
      
      const userContext = this.context.get(userId) || [];
      const oldContext = userContext.slice(0, -5);
      const recentContext = userContext.slice(-5);
      
      const compressed = await this.aiService.compressContext(oldContext);
      
      const compressedEntry: ContextEntry = {
        id: this.generateId(),
        timestamp: new Date(),
        type: 'conversation',
        content: compressed,
        metadata: { compressed: true, originalEntries: oldContext.length, userId },
      };

      this.context.set(userId, [compressedEntry, ...recentContext]);
      await this.saveContextImmediate();
      
      logger.debug(`Context compressed for user ${userId}: ${oldContext.length} entries → 1 compressed entry`);
    } catch (error) {
      logger.error(`Failed to compress context for user ${userId}:`, error);
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  // 获取所有用户的上下文统计
  getUserStats(): Record<string, { entries: number; totalLength: number }> {
    const stats: Record<string, { entries: number; totalLength: number }> = {};
    
    for (const [userId, entries] of this.context.entries()) {
      stats[userId] = {
        entries: entries.length,
        totalLength: entries.reduce((sum, entry) => sum + entry.content.length, 0)
      };
    }
    
    return stats;
  }

  // 清理用户上下文
  async clearUserContext(userId: string): Promise<void> {
    this.context.delete(userId);
    await this.saveContextImmediate();
    logger.debug(`Cleared context for user ${userId}`);
  }

  // 防抖保存方法
  private saveContextDebounced(): void {
    // 清除之前的定时器
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    
    // 设置新的定时器
    this.saveTimer = setTimeout(async () => {
      try {
        await this.saveContextImmediate();
        logger.debug('Context saved with debounced write');
      } catch (err) {
        logger.error('Failed to save context (debounced):', err);
      } finally {
        this.saveTimer = null;
      }
    }, 3000);
  }

  // 立即保存方法（用于重要操作）
  private async saveContextImmediate(): Promise<void> {
    const contextData: Record<string, ContextEntry[]> = {};
    for (const [userId, entries] of this.context.entries()) {
      contextData[userId] = entries;
    }
    
    await withFileLock(this.contextFile, async () => {
      await safeWriteJsonFile(this.contextFile, contextData, { backup: true });
    });
  }

}

export default ContextService;