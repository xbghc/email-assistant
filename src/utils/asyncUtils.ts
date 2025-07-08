import logger from './logger';

/**
 * 带超时的Promise包装器
 */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage?: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage || `Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

/**
 * 重试机制配置
 */
interface RetryOptions {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  exponentialBackoff: boolean;
  retryCondition?: (error: unknown) => boolean;
}

/**
 * 带重试的异步操作包装器
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    exponentialBackoff = true,
    retryCondition = () => true
  } = options;

  let lastError: unknown;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxAttempts || !retryCondition(error)) {
        throw error;
      }
      
      const delay = exponentialBackoff 
        ? Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay)
        : baseDelay;
      
      logger.warn(`Operation failed (attempt ${attempt}/${maxAttempts}), retrying in ${delay}ms:`, error);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * 带超时和重试的操作包装器
 */
export async function withTimeoutAndRetry<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  retryOptions: Partial<RetryOptions> = {}
): Promise<T> {
  return withRetry(
    () => withTimeout(operation(), timeoutMs),
    retryOptions
  );
}

/**
 * 安全的异步操作执行器 - 捕获所有错误
 */
export async function safeExecute<T>(
  operation: () => Promise<T>,
  fallbackValue?: T,
  errorMessage?: string
): Promise<T | undefined> {
  try {
    return await operation();
  } catch (error) {
    logger.error(errorMessage || 'Safe execute operation failed:', error);
    return fallbackValue;
  }
}

/**
 * 批量处理操作
 */
export async function batchProcess<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  batchSize: number = 10,
  delayBetweenBatches: number = 100
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchPromises = batch.map(item => 
      safeExecute(() => processor(item))
    );
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults.filter(result => result !== undefined) as R[]);
    
    // 批次之间添加延迟，避免过载
    if (i + batchSize < items.length && delayBetweenBatches > 0) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
    }
  }
  
  return results;
}

/**
 * 防抖函数
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  waitMs: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | undefined;
  
  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = setTimeout(() => {
      func(...args);
    }, waitMs);
  };
}

/**
 * 节流函数
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  waitMs: number
): (...args: Parameters<T>) => void {
  let lastCallTime = 0;
  
  return (...args: Parameters<T>) => {
    const now = Date.now();
    
    if (now - lastCallTime >= waitMs) {
      lastCallTime = now;
      func(...args);
    }
  };
}

/**
 * Promise 队列 - 限制并发数
 */
export class PromiseQueue {
  private queue: (() => Promise<unknown>)[] = [];
  private running = 0;
  
  constructor(private concurrency: number = 3) {}
  
  async add<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await operation();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      this.process();
    });
  }
  
  private async process(): Promise<void> {
    if (this.running >= this.concurrency || this.queue.length === 0) {
      return;
    }
    
    this.running++;
    const operation = this.queue.shift()!;
    
    try {
      await operation();
    } catch (error) {
      logger.error('Promise queue operation failed:', error);
    } finally {
      this.running--;
      this.process();
    }
  }
}

/**
 * 重试条件判断工具
 */
export const retryConditions = {
  // 网络错误重试
  networkError: (error: unknown): boolean => {
    const errorMessage = (error as any)?.message?.toLowerCase() || '';
    return errorMessage.includes('timeout') ||
           errorMessage.includes('econnrefused') ||
           errorMessage.includes('enotfound') ||
           errorMessage.includes('network');
  },
  
  // HTTP状态码重试
  httpRetryable: (error: unknown): boolean => {
    const status = (error as any)?.status || (error as any)?.response?.status;
    return status >= 500 && status < 600; // 5xx 错误
  },
  
  // 组合条件
  defaultRetryable: (error: unknown): boolean => {
    return retryConditions.networkError(error) || 
           retryConditions.httpRetryable(error);
  }
};

/**
 * 创建带有默认配置的重试包装器
 */
export const createRetryWrapper = (defaultOptions: Partial<RetryOptions>) => {
  return <T>(operation: () => Promise<T>, options: Partial<RetryOptions> = {}) => {
    return withRetry(operation, { ...defaultOptions, ...options });
  };
};

// 预定义的重试包装器
export const retryNetworkOperation = createRetryWrapper({
  maxAttempts: 3,
  baseDelay: 1000,
  exponentialBackoff: true,
  retryCondition: retryConditions.defaultRetryable
});

export const retryFileOperation = createRetryWrapper({
  maxAttempts: 2,
  baseDelay: 500,
  exponentialBackoff: false,
  retryCondition: (error: unknown) => {
    const code = (error as any)?.code;
    return code === 'EBUSY' || code === 'EMFILE' || code === 'ENFILE';
  }
});