import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';
import logger from './logger';

interface WriteOptions {
  backup?: boolean;
  debounceMs?: number;
}

interface PendingWrite {
  data: string;
  timeout: NodeJS.Timeout;
  resolve: (value: void) => void;
  reject: (error: Error) => void;
}

// 防抖写入队列
const pendingWrites = new Map<string, PendingWrite>();

/**
 * 原子写入文件 - 防止数据损坏
 */
export async function atomicWriteFile(filePath: string, data: string, options: WriteOptions = {}): Promise<void> {
  const { backup = true } = options;
  const tempPath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).substring(7)}`;
  const backupPath = backup ? `${filePath}.backup` : null;

  try {
    // 确保目录存在
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    // 如果需要备份且原文件存在
    if (backup && backupPath) {
      try {
        await fs.access(filePath);
        await fs.copyFile(filePath, backupPath);
      } catch {
        // 原文件不存在，不需要备份
      }
    }

    // 写入临时文件
    await fs.writeFile(tempPath, data, 'utf8');

    // 验证写入的数据
    const writtenData = await fs.readFile(tempPath, 'utf8');
    if (writtenData !== data) {
      throw new Error('Data verification failed after write');
    }

    // 原子性地替换原文件
    await fs.rename(tempPath, filePath);
    
    logger.debug(`File atomically written: ${filePath}`);
  } catch (error) {
    // 清理临时文件
    try {
      await fs.unlink(tempPath);
    } catch {
      // 忽略清理错误
    }
    throw error;
  }
}

/**
 * 防抖写入文件 - 减少频繁写入
 */
export function debouncedWriteFile(filePath: string, data: string, debounceMs: number = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    // 取消之前的写入
    const existingWrite = pendingWrites.get(filePath);
    if (existingWrite) {
      clearTimeout(existingWrite.timeout);
      existingWrite.resolve(); // 解析之前的Promise
    }

    // 创建新的防抖写入
    const timeout = setTimeout(async () => {
      pendingWrites.delete(filePath);
      try {
        await atomicWriteFile(filePath, data);
        resolve();
      } catch (error) {
        reject(error as Error);
      }
    }, debounceMs);

    pendingWrites.set(filePath, {
      data,
      timeout,
      resolve,
      reject
    });
  });
}

/**
 * 安全读取JSON文件
 */
export async function safeReadJsonFile<T>(filePath: string, defaultValue: T): Promise<T> {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      // 文件不存在，返回默认值
      return defaultValue;
    }
    
    // 尝试读取备份文件
    const backupPath = `${filePath}.backup`;
    try {
      const backupData = await fs.readFile(backupPath, 'utf8');
      logger.warn(`Main file corrupted, restored from backup: ${filePath}`);
      return JSON.parse(backupData);
    } catch {
      logger.error(`Failed to read file and backup: ${filePath}`, error);
      return defaultValue;
    }
  }
}

/**
 * 安全写入JSON文件
 */
export async function safeWriteJsonFile(filePath: string, data: unknown, options: WriteOptions = {}): Promise<void> {
  const jsonData = JSON.stringify(data, null, 2);
  
  if (options.debounceMs) {
    return debouncedWriteFile(filePath, jsonData, options.debounceMs);
  } else {
    return atomicWriteFile(filePath, jsonData, options);
  }
}

/**
 * 文件完整性验证
 */
export async function verifyFileIntegrity(filePath: string, expectedHash?: string): Promise<boolean> {
  try {
    const data = await fs.readFile(filePath);
    const hash = createHash('sha256').update(data).digest('hex');
    
    if (expectedHash) {
      return hash === expectedHash;
    }
    
    // 基本完整性检查 - 尝试解析JSON
    try {
      JSON.parse(data.toString());
      return true;
    } catch {
      return false;
    }
  } catch {
    return false;
  }
}

/**
 * 清理所有待写入的文件操作
 */
export function flushPendingWrites(): Promise<void[]> {
  const promises = Array.from(pendingWrites.entries()).map(([filePath, pendingWrite]) => {
    clearTimeout(pendingWrite.timeout);
    pendingWrites.delete(filePath);
    
    return atomicWriteFile(filePath, pendingWrite.data).then(
      () => pendingWrite.resolve(),
      (error) => pendingWrite.reject(error)
    );
  });
  
  return Promise.all(promises);
}

/**
 * 获取文件锁
 */
export class FileLock {
  private lockFile: string;
  private locked: boolean = false;

  constructor(filePath: string) {
    this.lockFile = `${filePath}.lock`;
  }

  async acquire(timeoutMs: number = 10000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        await fs.writeFile(this.lockFile, process.pid.toString(), { flag: 'wx' });
        this.locked = true;
        return;
      } catch (error: unknown) {
        if (error instanceof Error && 'code' in error && error.code === 'EEXIST') {
          // 检查锁文件是否过期
          try {
            const stats = await fs.stat(this.lockFile);
            const lockAge = Date.now() - stats.mtime.getTime();
            
            // 如果锁文件超过30秒，认为是僵尸锁
            if (lockAge > 30000) {
              await fs.unlink(this.lockFile);
              continue;
            }
          } catch {
            // 锁文件可能已被删除，继续尝试
          }
          
          // 等待一段时间后重试
          await new Promise(resolve => setTimeout(resolve, 100));
        } else {
          throw error;
        }
      }
    }
    
    throw new Error(`Failed to acquire file lock: ${this.lockFile}`);
  }

  async release(): Promise<void> {
    if (this.locked) {
      try {
        await fs.unlink(this.lockFile);
        this.locked = false;
      } catch {
        // 锁文件可能已被删除
        this.locked = false;
      }
    }
  }
}

/**
 * 带锁的文件操作
 */
export async function withFileLock<T>(filePath: string, operation: () => Promise<T>): Promise<T> {
  const lock = new FileLock(filePath);
  
  try {
    await lock.acquire();
    return await operation();
  } finally {
    await lock.release();
  }
}