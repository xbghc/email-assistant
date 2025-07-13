// API响应类型
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 用户类型
export interface User {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  config: {
    schedule: {
      morningReminderTime: string;
      eveningReminderTime: string;
      timezone: string;
    };
    language: 'zh' | 'en';
  };
}

// 系统状态类型
export interface SystemStatus {
  services: Array<{
    name: string;
    status: 'running' | 'warning' | 'error';
    description: string;
    uptime?: string;
    lastChecked: string;
  }>;
  metrics: {
    memoryUsage: {
      heapUsed: number;
      heapTotal: number;
    };
    cpuUsage: {
      user: number;
      system: number;
    };
    uptime: number;
    version: string;
    emailsToday: number;
    errorsLastHour: number;
    warningsLastHour: number;
  };
  timestamp: string;
  overall: string;
}

// 应用状态类型
export interface AppState {
  currentPage: string;
  data: {
    users: User[];
    systemStats: SystemStatus;
    logs: LogEntry[];
    settings: Record<string, unknown>;
  };
  auth: {
    token: string | null;
    user: User | null;
  };
}

// 日志类型
export interface LogEntry {
  level: 'info' | 'error' | 'warn' | 'debug';
  timestamp: string;
  message: string;
  meta?: Record<string, unknown>;
}

// 报告类型
export interface Report {
  id: string;
  type: string;
  title: string;
  userId: string;
  createdAt: string;
  status: string;
  summary: string;
  content?: string;
}

// 设置类型
export interface Settings {
  email: {
    smtpHost: string;
    smtpPort: number;
    emailUser: string;
    userEmail: string;
    userName: string;
  };
  ai: {
    provider: string;
    model: string;
    hasApiKey: boolean;
  };
  schedule: {
    morningTime: string;
    eveningTime: string;
    timezone: string;
    weeklyReportDay: number;
    weeklyReportTime: string;
  };
  server: {
    port: number;
    host: string;
    logLevel: string;
  };
  features: Record<string, boolean>;
}