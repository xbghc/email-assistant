import { User, UserConfig, UserStorage, UserRole } from '../../models/User';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../utils/logger';
import config from '../../config/index';
import { safeReadJsonFile, safeWriteJsonFile, withFileLock } from '../../utils/fileUtils';
import { userCache } from '../system/cacheService';

class UserService implements UserStorage {
  public users = new Map<string, User>();
  private emailToIdMap = new Map<string, string>(); // 邮箱到ID的快速映射
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
    // 先检查缓存
    const cacheKey = `user:id:${id}`;
    const cached = userCache.get<User>(cacheKey);
    if (cached) {
      return cached;
    }

    const user = this.users.get(id);
    if (user) {
      // 缓存用户数据10分钟
      userCache.set(cacheKey, user, 10 * 60 * 1000);
    }
    return user;
  }

  getUserByEmail(email: string): User | undefined {
    const normalizedEmail = email.toLowerCase();
    
    // 先检查缓存
    const cacheKey = `user:email:${normalizedEmail}`;
    const cached = userCache.get<User>(cacheKey);
    if (cached) {
      return cached;
    }

    // 使用邮箱映射快速查找（O(1)而不是O(n)）
    const userId = this.emailToIdMap.get(normalizedEmail);
    if (userId) {
      const user = this.users.get(userId);
      if (user) {
        // 缓存用户数据
        userCache.set(cacheKey, user, 10 * 60 * 1000);
        userCache.set(`user:id:${user.id}`, user, 10 * 60 * 1000);
        return user;
      }
    }
    return undefined;
  }

  addUser(user: User): void {
    this.users.set(user.id, user);
    // 更新邮箱映射
    this.emailToIdMap.set(user.email.toLowerCase(), user.id);
    // 清除相关缓存
    this.invalidateUserCache(user);
    // 使用防抖写入，5秒内的多次操作会合并
    this.saveToFileDebounced();
  }

  updateUser(id: string, updates: Partial<User>): void {
    const user = this.users.get(id);
    if (user) {
      const oldEmail = user.email;
      Object.assign(user, updates);
      user.updatedAt = new Date();
      
      // 如果邮箱发生变化，更新映射
      if (oldEmail !== user.email) {
        this.emailToIdMap.delete(oldEmail.toLowerCase());
        this.emailToIdMap.set(user.email.toLowerCase(), user.id);
        userCache.delete(`user:email:${oldEmail.toLowerCase()}`);
      }
      
      // 清除旧的和新的缓存
      this.invalidateUserCache(user);
      
      // 使用防抖写入，5秒内的多次操作会合并
      this.saveToFileDebounced();
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
    const user = this.users.get(id);
    if (user) {
      // 清除邮箱映射
      this.emailToIdMap.delete(user.email.toLowerCase());
      // 清除缓存
      this.invalidateUserCache(user);
    }
    this.users.delete(id);
    // 删除操作立即保存，不使用防抖
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
      
      await withFileLock(this.dataFile, async () => {
        await safeWriteJsonFile(this.dataFile, usersData, { backup: true });
      });
      
      logger.debug('Users saved to file with atomic write');
    } catch (error) {
      logger.error('Failed to save users to file:', error);
      throw error;
    }
  }

  // 防抖保存方法
  private saveToFileDebounced(): void {
    safeWriteJsonFile(this.dataFile, this.getSerializableUsers(), { 
      backup: true, 
      debounceMs: 5000 
    }).catch(err => logger.error('Failed to save users (debounced):', err));
  }

  // 获取可序列化的用户数据
  private getSerializableUsers(): any[] {
    return Array.from(this.users.entries()).map(([, user]) => ({
      ...user,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString()
    }));
  }

  async loadFromFile(): Promise<void> {
    try {
      const usersData = await safeReadJsonFile<any[]>(this.dataFile, []);
      
      this.users.clear();
      this.emailToIdMap.clear();
      
      for (const userData of usersData) {
        const user: User = {
          ...userData,
          createdAt: new Date(userData.createdAt),
          updatedAt: new Date(userData.updatedAt),
          lastLoginAt: userData.lastLoginAt ? new Date(userData.lastLoginAt) : undefined
        };
        this.users.set(user.id, user);
        // 重建邮箱映射
        this.emailToIdMap.set(user.email.toLowerCase(), user.id);
      }
      
      logger.debug(`Users loaded from file: ${this.users.size} users`);
    } catch (error) {
      logger.error('Failed to load users from file:', error);
      throw error;
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


  // 缓存失效辅助方法
  private invalidateUserCache(user: User): void {
    userCache.delete(`user:id:${user.id}`);
    userCache.delete(`user:email:${user.email.toLowerCase()}`);
  }

  // 获取缓存统计信息
  getCacheStats(): { size: number; hits: number; misses: number; hitRate: number; memoryUsage: number } {
    return userCache.getStats();
  }
}

export default UserService;