import { EventEmitter } from 'events';

// 统一的事件总线实例
export const eventBus = new EventEmitter();
eventBus.setMaxListeners(50);

// 事件元数据接口
export interface EventMetadata {
  eventId: string;
  timestamp: number;
  source: string;
  correlationId?: string;
  userId?: string;
}

// 基础事件接口
export interface BaseEvent {
  type: string;
  metadata: EventMetadata;
}

// 邮件相关事件
export interface EmailReceivedEvent extends BaseEvent {
  type: 'email:received';
  payload: {
    messageId: string;
    from: string;
    to: string;
    subject: string;
    body: string;
    userId: string;
    timestamp: Date;
  };
}

export interface EmailProcessedEvent extends BaseEvent {
  type: 'email:processed';
  payload: {
    messageId: string;
    userId: string;
    aiResponse: string;
    hasReminder: boolean;
    reminderCount?: number;
  };
}

export interface EmailReplySentEvent extends BaseEvent {
  type: 'email:reply:sent';
  payload: {
    messageId: string;
    userId: string;
    replyContent: string;
    originalSubject: string;
  };
}

export interface EmailSendFailedEvent extends BaseEvent {
  type: 'email:send:failed';
  payload: {
    messageId: string;
    userId: string;
    error: string;
    retryCount: number;
  };
}

// 提醒相关事件
export interface ReminderDetectedEvent extends BaseEvent {
  type: 'reminder:detected';
  payload: {
    messageId: string;
    userId: string;
    reminderText: string;
    extractedTime?: Date;
    confidence: number;
  };
}

export interface ReminderCreatedEvent extends BaseEvent {
  type: 'reminder:created';
  payload: {
    reminderId: string;
    userId: string;
    messageId: string;
    reminderText: string;
    scheduledTime: Date;
    status: 'pending' | 'sent' | 'failed';
  };
}

export interface ReminderSentEvent extends BaseEvent {
  type: 'reminder:sent';
  payload: {
    reminderId: string;
    userId: string;
    messageId: string;
    sentTime: Date;
    emailSent: boolean;
  };
}

export interface ReminderFailedEvent extends BaseEvent {
  type: 'reminder:failed';
  payload: {
    reminderId: string;
    userId: string;
    error: string;
    retryCount: number;
  };
}

// 用户相关事件
export interface UserCreatedEvent extends BaseEvent {
  type: 'user:created';
  payload: {
    userId: string;
    email: string;
    role: 'user' | 'admin';
    createdAt: Date;
  };
}

export interface UserAuthenticatedEvent extends BaseEvent {
  type: 'user:authenticated';
  payload: {
    userId: string;
    email: string;
    loginTime: Date;
    source: 'email' | 'web';
  };
}

// 系统相关事件
export interface SystemStartedEvent extends BaseEvent {
  type: 'system:started';
  payload: {
    startTime: Date;
    userCount: number;
    services: string[];
  };
}

export interface SystemHealthCheckEvent extends BaseEvent {
  type: 'system:health:check';
  payload: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: Record<string, boolean>;
    memoryUsage: number;
    uptime: number;
  };
}

// 联合类型
export type AppEvent = 
  | EmailReceivedEvent
  | EmailProcessedEvent
  | EmailReplySentEvent
  | EmailSendFailedEvent
  | ReminderDetectedEvent
  | ReminderCreatedEvent
  | ReminderSentEvent
  | ReminderFailedEvent
  | UserCreatedEvent
  | UserAuthenticatedEvent
  | SystemStartedEvent
  | SystemHealthCheckEvent;

// 事件类型常量
export const EVENT_TYPES = {
  EMAIL_RECEIVED: 'email:received',
  EMAIL_PROCESSED: 'email:processed',
  EMAIL_REPLY_SENT: 'email:reply:sent',
  EMAIL_SEND_FAILED: 'email:send:failed',
  REMINDER_DETECTED: 'reminder:detected',
  REMINDER_CREATED: 'reminder:created',
  REMINDER_SENT: 'reminder:sent',
  REMINDER_FAILED: 'reminder:failed',
  USER_CREATED: 'user:created',
  USER_AUTHENTICATED: 'user:authenticated',
  SYSTEM_STARTED: 'system:started',
  SYSTEM_HEALTH_CHECK: 'system:health:check',
} as const;

// 事件发布辅助函数
export function publishEvent<T extends AppEvent>(event: T): void {
  eventBus.emit(event.type, event);
}

// 生成事件ID的工具函数
export function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// 创建事件元数据的工具函数
export function createEventMetadata(
  source: string,
  correlationId?: string,
  userId?: string
): EventMetadata {
  const metadata: EventMetadata = {
    eventId: generateEventId(),
    timestamp: Date.now(),
    source,
  };
  
  if (correlationId !== undefined) {
    metadata.correlationId = correlationId;
  }
  
  if (userId !== undefined) {
    metadata.userId = userId;
  }
  
  return metadata;
}