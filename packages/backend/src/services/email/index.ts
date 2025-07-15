/**
 * 邮件服务模块导出
 */

// 主服务类
export { default as EmailService } from './emailService';

// 子模块
export { EmailCircuitBreaker } from './emailCircuitBreaker';
export { EmailQueue } from './emailQueue';
export { EmailTemplateGenerator } from './emailTemplates';
export { default as EmailContentManager } from './emailContentManager';
export { default as EmailStatsService } from './emailStatsService';
export { default as EmailReceiveService } from './emailReceiveService';
export { default as EmailReplyHandler } from './emailReplyHandler';

// 类型定义
export type {
  QueuedEmail,
  EmailContentType,
  EmailType,
  EmailStatus,
  EmailServiceStatus,
  AIGenerationOptions,
  EmailSendRecord
} from './emailTypes';

// 常量
export {
  QUEUE_CONFIG,
  CIRCUIT_BREAKER_CONFIG,
  CONNECTION_CONFIG,
  VERIFICATION_CONFIG,
  CONTENT_LIMITS,
  EmailPriority,
  TEMPLATE_DEFAULTS,
  LOG_MESSAGES,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES
} from './emailConstants';