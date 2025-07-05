export interface User {
  id: string;
  email: string;
  name: string;
  config: UserConfig;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
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