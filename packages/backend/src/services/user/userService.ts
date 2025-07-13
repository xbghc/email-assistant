import { User, UserConfig, UserStorage, UserRole } from '../../models/User';
import path from 'path';
import logger from '../../utils/logger';
import config from '../../config/index';
import { safeReadJsonFile, safeWriteJsonFile, withFileLock } from '../../utils/fileUtils';
import CacheService, { userCache } from '../system/cacheService';

// 定义可序列化的用户数据接口
interface SerializableUser extends Omit<User, 'createdAt' | 'updatedAt' | 'lastLoginAt'> {
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

class UserService implements UserStorage {
  public users = new Map<string, User>();
  private dataFile: string;
  private cache: CacheService;

  constructor(cache: CacheService = userCache, dataFile?: string) {
    this.cache = cache;
    
    if (dataFile) {
      this.dataFile = dataFile;
    } else {
      // 基于脚本文件位置确定后端根目录
      const scriptPath = process.argv[1] || process.cwd();
      const scriptDir = path.dirname(scriptPath);
      const backendRoot = path.resolve(scriptDir, '../../../'); // 从 src/services/user 到 packages/backend
      this.dataFile = path.join(backendRoot, 'data/users.json');
    }
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
    const normalizedId = id.toLowerCase();
    // 先检查缓存
    const cacheKey = `user:id:${normalizedId}`;
    const cached = this.cache.get<User>(cacheKey);
    if (cached) {
      return cached;
    }

    const user = this.users.get(normalizedId);
    if (user) {
      // 缓存用户数据10分钟
      this.cache.set(cacheKey, user, 10 * 60 * 1000);
    }
    return user;
  }

  getUserByEmail(email: string): User | undefined {
    const normalizedEmail = email.toLowerCase();

    // 先检查缓存
    const cacheKey = `user:email:${normalizedEmail}`;
    const cached = this.cache.get<User>(cacheKey);
    if (cached) {
      return cached;
    }

    // ID就是email
    const user = this.users.get(normalizedEmail);
    if (user) {
      // 缓存用户数据
      this.cache.set(cacheKey, user, 10 * 60 * 1000);
      this.cache.set(`user:id:${user.id}`, user, 10 * 60 * 1000);
      return user;
    }
    return undefined;
  }

  addUser(user: User): void {
    this.users.set(user.id, user);
    // 清除相关缓存
    this.invalidateUserCache(user);
    // 使用防抖写入，5秒内的多次操作会合并
    this.saveToFileDebounced();
  }

  updateUser(id: string, updates: Partial<User>): void {
    const user = this.users.get(id.toLowerCase());
    if (user) {
      const oldEmail = user.email;

      // 确保ID不会被修改
      const safeUpdates = { ...updates };
      delete (safeUpdates as Partial<User>).id;

      Object.assign(user, safeUpdates);
      user.updatedAt = new Date();

      // 如果邮箱发生变化，ID也必须变化，这意味着需要删除旧记录并添加新记录
      if (updates.email && oldEmail.toLowerCase() !== updates.email.toLowerCase()) {
        // 删除旧记录
        this.users.delete(oldEmail.toLowerCase());
        // 更新ID和Map中的键
        user.id = updates.email.toLowerCase();
        this.users.set(user.id, user);

        // 清除旧邮箱的缓存
        this.cache.delete(`user:email:${oldEmail.toLowerCase()}`);
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

  async updateUserConfig(id: string, newConfig: Partial<UserConfig>): Promise<boolean> {
    const user = this.users.get(id.toLowerCase());
    if (user) {
      // 安全地合并配置，而不是完全替换
      user.config = { ...user.config, ...newConfig };
      user.updatedAt = new Date();
      this.invalidateUserCache(user);
      await this.saveToFile();
      return true;
    }
    return false;
  }

  deleteUser(id: string): void {
    const user = this.users.get(id.toLowerCase());
    if (user) {
      // 清除缓存
      this.invalidateUserCache(user);
    }
    this.users.delete(id.toLowerCase());
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
      const usersData = this.getSerializableUsers();

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
      debounceMs: 5000,
    }).catch(err => logger.error('Failed to save users (debounced):', err));
  }

  // 获取可序列化的用户数据
  private getSerializableUsers(): SerializableUser[] {
    return Array.from(this.users.values()).map(user => {
      const { createdAt, updatedAt, lastLoginAt, ...rest } = user;
      return {
        ...rest,
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
        ...(lastLoginAt && { lastLoginAt: lastLoginAt.toISOString() }),
      };
    });
  }

  async loadFromFile(): Promise<void> {
    try {
      const usersData = await safeReadJsonFile<SerializableUser[]>(this.dataFile, []);

      this.users.clear();

      for (const userData of usersData) {
        const { lastLoginAt, ...restData } = userData;
        const user: User = {
          ...restData,
          createdAt: new Date(userData.createdAt),
          updatedAt: new Date(userData.updatedAt),
          ...(lastLoginAt && { lastLoginAt: new Date(lastLoginAt) }),
        };
        this.users.set(user.id, user);
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
        timezone: 'Asia/Shanghai',
      },
      language: 'zh',
    };

    const user: User = {
      id: email.toLowerCase(),
      email,
      name,
      role: this.isAdmin(email) ? UserRole.ADMIN : UserRole.USER,
      config: { ...defaultConfig, ...customConfig },
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
      emailVerified: false,
    };

    return user;
  }

  // 检查是否为管理员
  isAdmin(email: string): boolean {
    return email.toLowerCase() === config.email.admin.email.toLowerCase();
  }

  // 获取用户统计信息
  getStats(): { total: number; active: number; inactive: number } {
    const allUsers = this.getAllUsers();
    const activeUsers = allUsers.filter(u => u.isActive);

    return {
      total: allUsers.length,
      active: activeUsers.length,
      inactive: allUsers.length - activeUsers.length,
    };
  }

  // 缓存失效辅助方法
  private invalidateUserCache(user: User): void {
    this.cache.delete(`user:id:${user.id}`);
    this.cache.delete(`user:email:${user.email.toLowerCase()}`);
  }

  // 获取缓存统计信息
  getCacheStats(): {
    size: number;
    hits: number;
    misses: number;
    hitRate: number;
    memoryUsage: number;
  } {
    return this.cache.getStats();
  }
}

export default UserService;
