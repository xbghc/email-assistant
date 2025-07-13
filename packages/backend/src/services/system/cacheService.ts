import logger from '../../utils/logger';

interface CacheEntry<T> {
  value: T;
  expiry: number;
  hits: number;
  lastAccessed: number;
}

interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
  memoryUsage: number;
}

/**
 * 内存缓存服务
 */
export class CacheService {
  private cache = new Map<string, CacheEntry<unknown>>();
  private stats = { hits: 0, misses: 0 };
  private cleanupInterval?: NodeJS.Timeout | undefined;
  private readonly maxSize: number;
  private readonly defaultTtl: number;

  constructor(options: { maxSize?: number; defaultTtl?: number; cleanupInterval?: number } = {}) {
    this.maxSize = options.maxSize || 1000;
    this.defaultTtl = options.defaultTtl || 5 * 60 * 1000; // 5分钟
    
    // 在测试环境中禁用定期清理，避免影响Jest退出
    const isTestEnv = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;
    if (!isTestEnv) {
      const cleanupInterval = options.cleanupInterval || 60 * 1000; // 1分钟
      this.cleanupInterval = setInterval(() => {
        this.cleanup();
      }, cleanupInterval);
    }
  }

  /**
   * 设置缓存
   */
  set<T>(key: string, value: T, ttl?: number): void {
    const expiry = Date.now() + (ttl || this.defaultTtl);
    
    // 如果缓存已满，删除最少使用的条目
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }
    
    this.cache.set(key, {
      value,
      expiry,
      hits: 0,
      lastAccessed: Date.now()
    });
  }

  /**
   * 获取缓存
   */
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return undefined;
    }
    
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      this.stats.misses++;
      return undefined;
    }
    
    // 更新访问统计
    entry.hits++;
    entry.lastAccessed = Date.now();
    this.stats.hits++;
    
    return entry.value as T;
  }

  /**
   * 检查键是否存在
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * 删除缓存
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0 };
  }

  /**
   * 获取或设置缓存（如果不存在则执行获取函数）
   */
  async getOrSet<T>(
    key: string, 
    getter: () => Promise<T>, 
    ttl?: number
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }
    
    const value = await getter();
    this.set(key, value, ttl);
    return value;
  }

  /**
   * 清理过期缓存
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.debug(`Cache cleanup: removed ${cleaned} expired entries`);
    }
  }

  /**
   * LRU淘汰策略
   */
  private evictLRU(): void {
    let oldestKey = '';
    let oldestTime = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
      logger.debug(`Cache LRU eviction: removed ${oldestKey}`);
    }
  }

  /**
   * 获取缓存统计
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;
    
    // 估算内存使用量
    let memoryUsage = 0;
    for (const [key, entry] of this.cache.entries()) {
      memoryUsage += key.length * 2; // 字符串占用
      memoryUsage += JSON.stringify(entry.value).length * 2; // 值的大小估算
    }
    
    return {
      size: this.cache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: Math.round(hitRate * 100) / 100,
      memoryUsage
    };
  }

  /**
   * 销毁缓存服务
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    this.clear();
  }
}

/**
 * 特定功能的缓存管理器
 */
export class FunctionCache {
  private cache: CacheService;

  constructor(maxSize = 100, defaultTtl = 10 * 60 * 1000) { // 10分钟
    this.cache = new CacheService({ maxSize, defaultTtl });
  }

  /**
   * 缓存函数结果
   */
  async memoize<T extends (...args: unknown[]) => Promise<unknown>>(
    fn: T,
    keyGenerator?: (...args: Parameters<T>) => string
  ): Promise<T> {
    return (async (...args: Parameters<T>) => {
      const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);
      
      return this.cache.getOrSet(key, () => fn(...args));
    }) as T;
  }

  /**
   * 获取缓存统计
   */
  getStats(): CacheStats {
    return this.cache.getStats();
  }

  /**
   * 清理缓存
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 销毁缓存
   */
  destroy(): void {
    this.cache.destroy();
  }
}

// 全局缓存实例
export const globalCache = new CacheService({
  maxSize: 500,
  defaultTtl: 5 * 60 * 1000, // 5分钟
  cleanupInterval: 2 * 60 * 1000 // 2分钟清理一次
});

// 预定义的缓存实例
export const userCache = new CacheService({
  maxSize: 100,
  defaultTtl: 10 * 60 * 1000 // 用户数据缓存10分钟
});

export const emailStatsCache = new CacheService({
  maxSize: 50,
  defaultTtl: 5 * 60 * 1000 // 邮件统计缓存5分钟
});

export const aiResponseCache = new CacheService({
  maxSize: 200,
  defaultTtl: 30 * 60 * 1000 // AI响应缓存30分钟（用于相似查询）
});

// 在应用关闭时清理缓存
process.on('beforeExit', () => {
  globalCache.destroy();
  userCache.destroy();
  emailStatsCache.destroy();
  aiResponseCache.destroy();
});

export default CacheService;