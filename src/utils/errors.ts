/**
 * 统一的错误处理类型和工具
 */

export enum ErrorCode {
  // 配置相关错误
  CONFIG_VALIDATION_FAILED = 'CONFIG_VALIDATION_FAILED',
  CONFIG_MISSING_REQUIRED = 'CONFIG_MISSING_REQUIRED',
  
  // 邮件相关错误
  EMAIL_CONNECTION_FAILED = 'EMAIL_CONNECTION_FAILED',
  EMAIL_SEND_FAILED = 'EMAIL_SEND_FAILED',
  EMAIL_RECEIVE_FAILED = 'EMAIL_RECEIVE_FAILED',
  EMAIL_PARSING_FAILED = 'EMAIL_PARSING_FAILED',
  
  // AI服务相关错误
  AI_SERVICE_UNAVAILABLE = 'AI_SERVICE_UNAVAILABLE',
  AI_REQUEST_FAILED = 'AI_REQUEST_FAILED',
  AI_RESPONSE_INVALID = 'AI_RESPONSE_INVALID',
  AI_FUNCTION_CALL_FAILED = 'AI_FUNCTION_CALL_FAILED',
  
  // 用户相关错误
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  USER_ALREADY_EXISTS = 'USER_ALREADY_EXISTS',
  USER_NOT_ACTIVE = 'USER_NOT_ACTIVE',
  USER_UNAUTHORIZED = 'USER_UNAUTHORIZED',
  
  // 数据相关错误
  DATA_SAVE_FAILED = 'DATA_SAVE_FAILED',
  DATA_LOAD_FAILED = 'DATA_LOAD_FAILED',
  DATA_VALIDATION_FAILED = 'DATA_VALIDATION_FAILED',
  
  // 网络相关错误
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  NETWORK_CONNECTION_FAILED = 'NETWORK_CONNECTION_FAILED',
  
  // 通用错误
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  INVALID_PARAMETER = 'INVALID_PARAMETER',
  OPERATION_FAILED = 'OPERATION_FAILED'
}

export class EmailAssistantError extends Error {
  public readonly code: ErrorCode;
  public readonly context: Record<string, unknown> | undefined;
  public readonly timestamp: Date;

  constructor(
    code: ErrorCode, 
    message: string, 
    context?: Record<string, unknown>,
    cause?: Error
  ) {
    super(message);
    this.name = 'EmailAssistantError';
    this.code = code;
    this.context = context;
    this.timestamp = new Date();
    
    if (cause) {
      this.stack = `${this.stack}\nCaused by: ${cause.stack}`;
    }
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}

// 具体的错误类型
export class ConfigError extends EmailAssistantError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(ErrorCode.CONFIG_VALIDATION_FAILED, message, context);
    this.name = 'ConfigError';
  }
}

export class EmailError extends EmailAssistantError {
  constructor(code: ErrorCode, message: string, context?: Record<string, unknown>, cause?: Error) {
    super(code, message, context, cause);
    this.name = 'EmailError';
  }
}

export class AIServiceError extends EmailAssistantError {
  constructor(code: ErrorCode, message: string, context?: Record<string, unknown>, cause?: Error) {
    super(code, message, context, cause);
    this.name = 'AIServiceError';
  }
}

export class UserError extends EmailAssistantError {
  constructor(code: ErrorCode, message: string, context?: Record<string, unknown>) {
    super(code, message, context);
    this.name = 'UserError';
  }
}

export class DataError extends EmailAssistantError {
  constructor(code: ErrorCode, message: string, context?: Record<string, unknown>, cause?: Error) {
    super(code, message, context, cause);
    this.name = 'DataError';
  }
}

// 错误处理工具函数
export function isEmailAssistantError(error: unknown): error is EmailAssistantError {
  return error instanceof EmailAssistantError;
}

export function formatError(error: Error): string {
  if (isEmailAssistantError(error)) {
    const contextStr = error.context ? ` (${JSON.stringify(error.context)})` : '';
    return `[${error.code}] ${error.message}${contextStr}`;
  }
  return error.message || 'Unknown error occurred';
}

export function createConfigError(message: string, context?: Record<string, unknown>): ConfigError {
  return new ConfigError(message, context);
}

export function createEmailError(
  code: ErrorCode = ErrorCode.EMAIL_SEND_FAILED, 
  message: string, 
  context?: Record<string, unknown>,
  cause?: Error
): EmailError {
  return new EmailError(code, message, context, cause);
}

export function createAIServiceError(
  code: ErrorCode = ErrorCode.AI_REQUEST_FAILED,
  message: string,
  context?: Record<string, unknown>,
  cause?: Error
): AIServiceError {
  return new AIServiceError(code, message, context, cause);
}

export function createUserError(
  code: ErrorCode = ErrorCode.USER_NOT_FOUND,
  message: string,
  context?: Record<string, unknown>
): UserError {
  return new UserError(code, message, context);
}

export function createDataError(
  code: ErrorCode = ErrorCode.DATA_SAVE_FAILED,
  message: string,
  context?: Record<string, unknown>,
  cause?: Error
): DataError {
  return new DataError(code, message, context, cause);
}

// 错误重试工具
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000,
  shouldRetry?: (error: Error) => boolean
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (shouldRetry && !shouldRetry(lastError)) {
        throw lastError;
      }
      
      if (attempt === maxRetries) {
        throw new EmailAssistantError(
          ErrorCode.OPERATION_FAILED,
          `Operation failed after ${maxRetries} attempts`,
          { attempts: maxRetries, lastError: lastError.message },
          lastError
        );
      }
      
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }
  
  throw lastError!;
}