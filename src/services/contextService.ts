import fs from 'fs/promises';
import path from 'path';
import { ContextEntry } from '../models';
import config from '../config';
import logger from '../utils/logger';
import AIService from './aiService';

class ContextService {
  private contextFile: string;
  private context: ContextEntry[] = [];
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

    this.context.push(entry);
    await this.saveContext();
    
    if (this.shouldCompress()) {
      await this.compressContext();
    }

    logger.info(`Context entry added: ${type}`);
  }

  async getContext(limit?: number): Promise<ContextEntry[]> {
    return limit ? this.context.slice(-limit) : this.context;
  }

  async getContextByType(type: ContextEntry['type'], limit?: number): Promise<ContextEntry[]> {
    const filtered = this.context.filter(entry => entry.type === type);
    return limit ? filtered.slice(-limit) : filtered;
  }

  async getRecentContext(days: number = 7): Promise<ContextEntry[]> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    
    return this.context.filter(entry => entry.timestamp >= cutoff);
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
      this.context = parsed.map((entry: any) => ({
        ...entry,
        timestamp: new Date(entry.timestamp),
      }));
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        this.context = [];
        await this.saveContext();
      } else {
        throw error;
      }
    }
  }

  private async saveContext(): Promise<void> {
    try {
      await fs.writeFile(this.contextFile, JSON.stringify(this.context, null, 2));
    } catch (error) {
      logger.error('Failed to save context:', error);
      throw error;
    }
  }

  private shouldCompress(): boolean {
    const totalLength = this.context.reduce((sum, entry) => sum + entry.content.length, 0);
    return totalLength > config.context.compressionThreshold;
  }

  private async compressContext(): Promise<void> {
    try {
      logger.info('Starting context compression...');
      
      const oldContext = this.context.slice(0, -5);
      const recentContext = this.context.slice(-5);
      
      const compressed = await this.aiService.compressContext(oldContext);
      
      const compressedEntry: ContextEntry = {
        id: this.generateId(),
        timestamp: new Date(),
        type: 'conversation',
        content: compressed,
        metadata: { compressed: true, originalEntries: oldContext.length },
      };

      this.context = [compressedEntry, ...recentContext];
      await this.saveContext();
      
      logger.info(`Context compressed: ${oldContext.length} entries → 1 compressed entry`);
    } catch (error) {
      logger.error('Failed to compress context:', error);
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default ContextService;