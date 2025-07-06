export interface User {
  id: string;
  email: string;
  name: string;
  password?: string; // hashed password
  role: UserRole;
  config: UserConfig;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  lastLoginAt?: Date;
  emailVerified: boolean;
  resetToken?: string;
  resetTokenExpiry?: Date;
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

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  timezone?: string;
}

export interface AuthResponse {
  user: Omit<User, 'password'>;
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
  validatePassword(email: string, password: string): Promise<boolean>;
  updatePassword(userId: string, newPassword: string): Promise<void>;
  generateResetToken(email: string): Promise<string | null>;
  resetPassword(token: string, newPassword: string): Promise<boolean>;
}