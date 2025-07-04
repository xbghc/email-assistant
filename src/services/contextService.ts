import fs from 'fs/promises';
import path from 'path';
import { ContextEntry } from '../models';
import config from '../config';
import logger from '../utils/logger';
import AIService from './aiService';

class ContextService {
  private contextFile: string;
  private context: Map<string, ContextEntry[]> = new Map(); // 用户ID -> 上下文数组
  private aiService: AIService;

  constructor() {
    this.contextFile = path.join(process.cwd(), 'data', 'context.json');
    this.aiService = new AIService();
  }

  async initialize(): Promise<void> {
    try {
      await this.ensureDataDirectory();
      await this.loadContext();
      logger.info('Context service initialized');
    } catch (error) {
      logger.error('Failed to initialize context service:', error);
      throw error;
    }
  }

  async addEntry(type: ContextEntry['type'], content: string, metadata?: Record<string, any>): Promise<void> {
    const entry: ContextEntry = {
      id: this.generateId(),
      timestamp: new Date(),
      type,
      content,
      metadata,
    };

    this.context.get(userId)!.push(entry);
    await this.saveContext();
    
    if (this.shouldCompress(userId)) {
      await this.compressContext(userId);
    }

    logger.info(`Context entry added: ${type}`);
  }

  async getContext(limit?: number): Promise<ContextEntry[]> {
    return limit ? this.context.slice(-limit) : this.context;
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
      const data = await fs.readFile(this.contextFile, 'utf-8');
      const parsed = JSON.parse(data);
      
      this.context.clear();
      if (Array.isArray(parsed)) {
        // 兼容旧格式：直接是数组，转换为admin用户的上下文
        const entries = parsed.map((entry: any) => ({
          ...entry,
          timestamp: new Date(entry.timestamp),
        }));
        this.context.set('admin', entries);
      } else {
        // 新格式：用户ID -> 上下文数组的映射
        for (const [userId, entries] of Object.entries(parsed)) {
          const userEntries = (entries as any[]).map((entry: any) => ({
            ...entry,
            timestamp: new Date(entry.timestamp),
          }));
          this.context.set(userId, userEntries);
        }
      }
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        this.context.clear();
        await this.saveContext();
      } else {
        throw error;
      }
    }
  }

  private async saveContext(): Promise<void> {
    try {
      // 转换Map为普通对象进行序列化
      const contextObj: Record<string, ContextEntry[]> = {};
      for (const [userId, entries] of this.context.entries()) {
        contextObj[userId] = entries;
      }
      await fs.writeFile(this.contextFile, JSON.stringify(contextObj, null, 2));
    } catch (error) {
      logger.error('Failed to save context:', error);
      throw error;
    }
  }

  private shouldCompress(userId: string): boolean {
    const userContext = this.context.get(userId) || [];
    const totalLength = userContext.reduce((sum, entry) => sum + entry.content.length, 0);
    return totalLength > config.context.compressionThreshold;
  }

  private async compressContext(userId: string): Promise<void> {
    try {
      logger.info(`Starting context compression for user ${userId}...`);
      
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
      await this.saveContext();
      
      logger.info(`Context compressed for user ${userId}: ${oldContext.length} entries → 1 compressed entry`);
    } catch (error) {
      logger.error(`Failed to compress context for user ${userId}:`, error);
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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
    await this.saveContext();
    logger.info(`Cleared context for user ${userId}`);
  }
}

export default ContextService;