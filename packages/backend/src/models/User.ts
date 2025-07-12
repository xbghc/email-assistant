export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  config: UserConfig;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  lastLoginAt?: Date;
  emailVerified: boolean;
  // 邮箱验证码登录相关字段
  verificationCode?: string;
  verificationCodeExpiry?: Date;
  verificationCodeAttempts?: number;
  lastVerificationCodeSent?: Date;
}

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user'
}

export interface UserConfig {
  // 日程配置
  schedule: {
    morningReminderTime: string; // HH:MM格式
    eveningReminderTime: string; // HH:MM格式
    timezone: string;
  };
  
  // 语言配置
  language: 'zh' | 'en';
  
  // 提醒暂停配置
  reminderPaused?: boolean;
  resumeDate?: string; // ISO字符串格式
}

export interface AdminCommand {
  command: string;
  description: string;
  usage: string;
  handler: (args: string[]) => Promise<string>;
}

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

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
}

export interface UserStorage {
  users: Map<string, User>;
  getUserById(id: string): User | undefined;
  getUserByEmail(email: string): User | undefined;
  addUser(user: User): void;
  updateUser(id: string, updates: Partial<User>): void;
  deleteUser(id: string): void;
  getAllUsers(): User[];
  getActiveUsers(): User[];
  saveToFile(): Promise<void>;
  loadFromFile(): Promise<void>;
}