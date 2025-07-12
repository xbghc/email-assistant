// Shared types and utilities for email assistant

export interface User {
  id: string;
  username: string;
  email: string;
  password: string;
  role: 'Admin' | 'User';
  created_at: string;
  preferences: {
    morning_reminder: boolean;
    evening_reminder: boolean;
    weekly_report: boolean;
    timezone: string;
  };
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

export interface ApiResponse<T = any> {
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
    LOGIN: '/api/auth/login',
    LOGOUT: '/api/auth/logout',
    VERIFY: '/api/auth/verify'
  },
  SCHEDULE: {
    GET: '/api/schedule',
    UPDATE: '/api/schedule',
    STATUS: '/api/schedule/status'
  },
  HEALTH: '/api/health'
} as const;

export const USER_ROLES = {
  ADMIN: 'Admin',
  USER: 'User'
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];