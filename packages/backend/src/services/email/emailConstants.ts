/**
 * 邮件服务常量配置
 */

/**
 * 邮件队列配置
 */
export const QUEUE_CONFIG = {
  PROCESS_INTERVAL: 60000, // 队列处理间隔（毫秒）
  DEFAULT_MAX_ATTEMPTS: 3, // 默认最大重试次数
  INITIAL_RETRY_DELAY: 30000, // 初始重试延迟（毫秒）
  EXPONENTIAL_BACKOFF_BASE: 2, // 指数退避基数
} as const;

/**
 * 熔断器配置
 */
export const CIRCUIT_BREAKER_CONFIG = {
  FAILURE_THRESHOLD: 3, // 失败阈值
  RESET_TIMEOUT: 60000, // 重置超时时间（毫秒）
} as const;

/**
 * 邮件连接配置
 */
export const CONNECTION_CONFIG = {
  POOL_ENABLED: true, // 启用连接池
  MAX_CONNECTIONS: 3, // 最大连接数
  MAX_MESSAGES: 10, // 每个连接的最大消息数
  CONNECTION_TIMEOUT: 30000, // 连接超时时间（毫秒）
  SOCKET_TIMEOUT: 30000, // 套接字超时时间（毫秒）
} as const;

/**
 * 验证码配置
 */
export const VERIFICATION_CONFIG = {
  CODE_EXPIRY_MINUTES: 30, // 验证码有效期（分钟）
} as const;

/**
 * 邮件内容长度限制
 */
export const CONTENT_LIMITS = {
  MAX_SUBJECT_LENGTH: 200, // 主题最大长度
  MAX_CONTENT_LENGTH: 10000, // 内容最大长度
  MAX_ATTACHMENT_SIZE: 25 * 1024 * 1024, // 附件最大大小（25MB）
} as const;

/**
 * 邮件发送优先级
 */
export enum EmailPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent'
}

/**
 * 邮件模板默认设置
 */
export const TEMPLATE_DEFAULTS = {
  AI_GENERATION_TIMEOUT: 30000, // AI生成超时时间（毫秒）
  FALLBACK_ENABLED: true, // 启用回退模板
  DEFAULT_LANGUAGE: 'zh-CN', // 默认语言
} as const;

/**
 * 日志相关常量
 */
export const LOG_MESSAGES = {
  CIRCUIT_BREAKER_OPENED: '🚨 Email circuit breaker opened',
  CIRCUIT_BREAKER_RESET: '📧 Email circuit breaker reset',
  EMAIL_QUEUED: '📪 Email queued for retry',
  EMAIL_SENT_SUCCESS: '✅ Email sent successfully',
  EMAIL_SENT_FAILED: '❌ Email send failed',
  QUEUE_PROCESSING: '📨 Processing email queue',
  SERVICE_INITIALIZED: '📧 Email service initialized',
  SERVICE_SHUTDOWN: '📧 Email service shutdown',
} as const;

/**
 * 错误消息常量
 */
export const ERROR_MESSAGES = {
  SERVICE_UNAVAILABLE: 'Email service temporarily unavailable',
  INVALID_EMAIL_ADDRESS: 'Invalid email address',
  CONTENT_TOO_LONG: 'Email content exceeds maximum length',
  ATTACHMENT_TOO_LARGE: 'Attachment size exceeds limit',
  TEMPLATE_GENERATION_FAILED: 'Template generation failed',
  QUEUE_FULL: 'Email queue is full',
} as const;

/**
 * 成功消息常量
 */
export const SUCCESS_MESSAGES = {
  EMAIL_SENT: 'Email sent successfully',
  TEMPLATE_GENERATED: 'Template generated successfully',
  QUEUE_PROCESSED: 'Email queue processed successfully',
  SERVICE_STARTED: 'Email service started successfully',
} as const;