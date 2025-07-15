import logger from '../../utils/logger';

/**
 * 邮件服务熔断器
 * 防止邮件服务故障导致系统崩溃
 */
export class EmailCircuitBreaker {
  private failures = 0;
  private isOpen = false;
  private lastFailureTime = 0;
  private readonly failureThreshold = 3;
  private readonly resetTimeout = 60000; // 1分钟
  
  /**
   * 执行操作，如果熔断器开启则直接抛出错误
   * @param operation 要执行的操作
   * @returns 操作结果
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.isOpen) {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.isOpen = false;
        this.failures = 0;
        logger.info('📧 Email circuit breaker reset');
      } else {
        throw new Error('Email service temporarily unavailable');
      }
    }
    
    try {
      const result = await operation();
      this.failures = 0;
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();
      
      if (this.failures >= this.failureThreshold) {
        this.isOpen = true;
        logger.warn(`🚨 Email circuit breaker opened after ${this.failures} failures`);
      }
      
      throw error;
    }
  }

  /**
   * 获取熔断器状态
   */
  getStatus(): {
    isOpen: boolean;
    failures: number;
    lastFailureTime: number;
  } {
    return {
      isOpen: this.isOpen,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime
    };
  }

  /**
   * 重置熔断器
   */
  reset(): void {
    this.failures = 0;
    this.isOpen = false;
    this.lastFailureTime = 0;
    logger.info('📧 Email circuit breaker manually reset');
  }
}

export default EmailCircuitBreaker;