// Shared types and utilities for email assistant

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  config: {
    schedule: {
      morningReminderTime: string;
      eveningReminderTime: string;
      timezone: string;
    };
    language: 'zh' | 'en';
    reminderPaused?: boolean;
    resumeDate?: string;
  };
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  lastLoginAt?: string;
  emailVerified: boolean;
}

export interface EmailRecord {
  id: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  body: string;
  type: 'reminder' | 'report' | 'reply';
  userId: string;
}

export interface ScheduleConfig {
  morningReminder: {
    enabled: boolean;
    time: string;
    timezone: string;
  };
  eveningReminder: {
    enabled: boolean;
    time: string;
    timezone: string;
  };
  weeklyReport: {
    enabled: boolean;
    day: string;
    time: string;
    timezone: string;
  };
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ReminderStatus {
  date: string;
  morning: {
    sent: boolean;
    timestamp?: string;
    error?: string;
  };
  evening: {
    sent: boolean;
    timestamp?: string;
    error?: string;
  };
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: {
    email: 'up' | 'down' | 'degraded';
    ai: 'up' | 'down' | 'degraded';
    database: 'up' | 'down' | 'degraded';
  };
  uptime: number;
  version: string;
}

export const API_ENDPOINTS = {
  AUTH: {
    SEND_CODE: '/api/auth/send-code',
    VERIFY_CODE: '/api/auth/verify-code',
    LOGOUT: '/api/auth/logout',
    ME: '/api/auth/me',
    REFRESH_TOKEN: '/api/auth/refresh-token',
    REGISTER: '/api/auth/register'
  },
  SCHEDULE: {
    GET: '/api/schedule',
    UPDATE: '/api/schedule',
    STATUS: '/api/schedule/status'
  },
  HEALTH: '/api/health'
} as const;

export const USER_ROLES = {
  ADMIN: 'admin',
  USER: 'user'
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

// Auth request/response types
export interface SendCodeRequest {
  email: string;
}

export interface VerifyCodeRequest {
  email: string;
  code: string;
}

export interface RegisterRequest {
  email: string;
  name: string;
  timezone?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  expiresIn: number;
}