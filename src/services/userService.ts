import { User, UserConfig, UserStorage } from '../models/User';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';
import config from '../config';

class UserService implements UserStorage {
  private users = new Map<string, User>();
  private dataFile: string;

  constructor() {
    this.dataFile = path.join(process.cwd(), 'users.json');
  }

  async initialize(): Promise<void> {
    try {
      await this.loadFromFile();
      logger.info(`Loaded ${this.users.size} users from storage`);
    } catch (error) {
      logger.info('No existing user data found, starting with empty user list');
    }
  }

  getUserById(id: string): User | undefined {
    return this.users.get(id);
  }

  getUserByEmail(email: string): User | undefined {
    for (const user of this.users.values()) {
      if (user.email.toLowerCase() === email.toLowerCase()) {
        return user;
      }
    }
    return undefined;
  }

  addUser(user: User): void {
    this.users.set(user.id, user);
    this.saveToFile().catch(err => logger.error('Failed to save users:', err));
  }

  updateUser(id: string, updates: Partial<User>): void {
    const user = this.users.get(id);
    if (user) {
      Object.assign(user, updates);
      user.updatedAt = new Date();
      this.saveToFile().catch(err => logger.error('Failed to save users:', err));
    }
  }

  deleteUser(id: string): void {
    this.users.delete(id);
    this.saveToFile().catch(err => logger.error('Failed to save users:', err));
  }

  getAllUsers(): User[] {
    return Array.from(this.users.values());
  }

  getActiveUsers(): User[] {
    return Array.from(this.users.values()).filter(user => user.isActive);
  }

  async saveToFile(): Promise<void> {
    try {
      const usersData = Array.from(this.users.entries()).map(([id, user]) => ({
        id,
        ...user,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString()
      }));
      
      await fs.writeFile(this.dataFile, JSON.stringify(usersData, null, 2));
      logger.debug('Users saved to file');
    } catch (error) {
      logger.error('Failed to save users to file:', error);
      throw error;
    }
  }

  async loadFromFile(): Promise<void> {
    try {
      const data = await fs.readFile(this.dataFile, 'utf-8');
      const usersData = JSON.parse(data);
      
      this.users.clear();
      for (const userData of usersData) {
        const user: User = {
          ...userData,
          createdAt: new Date(userData.createdAt),
          updatedAt: new Date(userData.updatedAt)
        };
        this.users.set(user.id, user);
      }
      
      logger.debug('Users loaded from file');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        logger.error('Failed to load users from file:', error);
        throw error;
      }
    }
  }

  // 创建新用户的辅助方法
  createUser(email: string, name: string, customConfig?: Partial<UserConfig>): User {
    const defaultConfig: UserConfig = {
      schedule: {
        morningReminderTime: '09:00',
        eveningReminderTime: '18:00',
        timezone: 'Asia/Shanghai'
      },
      language: 'zh'
    };

    const user: User = {
      id: uuidv4(),
      email,
      name,
      config: { ...defaultConfig, ...customConfig },
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true
    };

    return user;
  }

  // 检查是否为管理员
  isAdmin(email: string): boolean {
    return email.toLowerCase() === config.email.user.email.toLowerCase();
  }

  // 获取用户统计信息
  getStats(): { total: number; active: number; inactive: number } {
    const allUsers = this.getAllUsers();
    const activeUsers = allUsers.filter(u => u.isActive);
    
    return {
      total: allUsers.length,
      active: activeUsers.length,
      inactive: allUsers.length - activeUsers.length
    };
  }
}

export default UserService;