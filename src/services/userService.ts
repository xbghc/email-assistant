import { User, UserConfig, UserStorage, UserRole } from '../models/User';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import logger from '../utils/logger';
import config from '../config';

class UserService implements UserStorage {
  public users = new Map<string, User>();
  private dataFile: string;

  constructor() {
    this.dataFile = path.join(process.cwd(), 'users.json');
  }

  async initialize(): Promise<void> {
    try {
      await this.loadFromFile();
      logger.info(`Loaded ${this.users.size} users from storage`);
    } catch {
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

  // 添加便捷方法
  async addUserByInfo(username: string, email: string, name?: string): Promise<User> {
    const user = this.createUser(email, name || username);
    this.addUser(user);
    return user;
  }

  async removeUser(identifier: string): Promise<boolean> {
    const user = this.getUserById(identifier) || this.getUserByUsername(identifier);
    if (user) {
      this.deleteUser(user.id);
      return true;
    }
    return false;
  }

  getUserByUsername(username: string): User | undefined {
    for (const user of this.users.values()) {
      if (user.name.toLowerCase() === username.toLowerCase()) {
        return user;
      }
    }
    return undefined;
  }

  async updateUserConfig(id: string, config: UserConfig): Promise<boolean> {
    const user = this.users.get(id);
    if (user) {
      user.config = config;
      user.updatedAt = new Date();
      await this.saveToFile();
      return true;
    }
    return false;
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
      const usersData = Array.from(this.users.entries()).map(([, user]) => ({
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
          updatedAt: new Date(userData.updatedAt),
          resetTokenExpiry: userData.resetTokenExpiry ? new Date(userData.resetTokenExpiry) : undefined
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
      role: this.isAdmin(email) ? UserRole.ADMIN : UserRole.USER,
      config: { ...defaultConfig, ...customConfig },
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
      emailVerified: false
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

  // 验证密码
  async validatePassword(email: string, password: string): Promise<boolean> {
    const user = this.getUserByEmail(email);
    if (!user || !user.password) {
      return false;
    }
    return await bcrypt.compare(password, user.password);
  }

  // 更新密码
  async updatePassword(userId: string, newPassword: string): Promise<void> {
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    this.updateUser(userId, { 
      password: hashedPassword,
      updatedAt: new Date()
    });
  }

  // 生成密码重置令牌
  async generateResetToken(email: string): Promise<string | null> {
    const user = this.getUserByEmail(email);
    if (!user) {
      return null;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1小时后过期

    this.updateUser(user.id, {
      resetToken,
      resetTokenExpiry,
      updatedAt: new Date()
    });

    return resetToken;
  }

  // 重置密码
  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    const users = this.getAllUsers();
    const user = users.find(u => u.resetToken === token);

    if (!user) {
      return false;
    }

    // 检查令牌是否过期
    if (!user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
      return false;
    }

    // 更新密码并清除重置令牌
    await this.updatePassword(user.id, newPassword);
    
    // 清除重置令牌
    const updatedUser = this.getUserById(user.id);
    if (updatedUser) {
      delete updatedUser.resetToken;
      delete updatedUser.resetTokenExpiry;
      updatedUser.updatedAt = new Date();
      this.updateUser(user.id, updatedUser);
    }

    return true;
  }
}

export default UserService;