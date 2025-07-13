import UserService from '../user/userService';
import { CacheService } from '../system/cacheService';
import { UserRole, UserConfig } from '../../models/User';

// Mock dependencies
jest.mock('../system/cacheService');
jest.mock('../../utils/fileUtils', () => ({
  safeReadJsonFile: jest.fn(),
  safeWriteJsonFile: jest.fn().mockResolvedValue(undefined),
  withFileLock: jest.fn((filePath, operation) => operation())
}));

jest.mock('../../config/index', () => ({
  email: {
    admin: {
      email: 'admin@test.com'
    }
  }
}));

const MockedCacheService = CacheService as jest.MockedClass<typeof CacheService>;

describe('UserService', () => {
  let userService: UserService;
  let mockCache: jest.Mocked<CacheService>;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mockFileUtils = require('../../utils/fileUtils');

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();

    // Setup cache mock
    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      has: jest.fn(),
      clear: jest.fn(),
      getOrSet: jest.fn(),
      destroy: jest.fn(),
      getStats: jest.fn().mockReturnValue({
        size: 0,
        hits: 0,
        misses: 0,
        hitRate: 0,
        memoryUsage: 0
      })
    } as unknown as jest.Mocked<CacheService>;

    MockedCacheService.mockImplementation(() => mockCache);

    // Create service with mocked cache and test file path
    userService = new UserService(mockCache, '/tmp/test-users.json');
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('initialization', () => {
    it('should initialize with admin user when file does not exist', async () => {
      mockFileUtils.safeReadJsonFile.mockResolvedValue([]);

      await userService.initialize();

      expect(mockFileUtils.safeReadJsonFile).toHaveBeenCalledWith('/tmp/test-users.json', []);
      expect(userService.getAllUsers()).toHaveLength(1);
      expect(userService.getAllUsers()[0]!.email).toBe('admin@test.com');
      expect(userService.getAllUsers()[0]!.role).toBe('admin');
    });

    it('should load existing users from file', async () => {
      const mockUsers = [
        {
          id: 'test@example.com',
          email: 'test@example.com',
          name: 'Test User',
          role: UserRole.USER,
          config: {
            schedule: {
              morningReminderTime: '09:00',
              eveningReminderTime: '18:00',
              timezone: 'Asia/Shanghai'
            },
            language: 'zh'
          },
          isActive: true,
          emailVerified: false,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z'
        }
      ];

      mockFileUtils.safeReadJsonFile.mockResolvedValue(mockUsers);

      await userService.initialize();

      const users = userService.getAllUsers();
      expect(users).toHaveLength(2); // Loaded user + admin user
      const testUser = users.find(u => u.email === 'test@example.com');
      expect(testUser).toBeDefined();
      expect(testUser!.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('createUser', () => {
    it('should create user with default config', () => {
      const user = userService.createUser('test@example.com', 'Test User');

      expect(user.id).toBe('test@example.com');
      expect(user.email).toBe('test@example.com');
      expect(user.name).toBe('Test User');
      expect(user.role).toBe(UserRole.USER);
      expect(user.isActive).toBe(true);
      expect(user.emailVerified).toBe(false);
      expect(user.config.schedule.morningReminderTime).toBe('09:00');
      expect(user.config.schedule.eveningReminderTime).toBe('18:00');
      expect(user.config.language).toBe('zh');
    });

    it('should create user with custom config', () => {
      const customConfig: Partial<UserConfig> = {
        schedule: {
          morningReminderTime: '08:00',
          eveningReminderTime: '20:00',
          timezone: 'UTC'
        }
      };

      const user = userService.createUser('test@example.com', 'Test User', customConfig);

      expect(user.config.schedule.morningReminderTime).toBe('08:00');
      expect(user.config.schedule.eveningReminderTime).toBe('20:00');
      expect(user.config.schedule.timezone).toBe('UTC');
    });

    it('should create admin user for configured admin email', () => {
      const user = userService.createUser('admin@test.com', 'Admin User');
      expect(user.role).toBe(UserRole.ADMIN);
    });
  });

  describe('user management', () => {
    beforeEach(async () => {
      mockFileUtils.safeReadJsonFile.mockResolvedValue([]);
      await userService.initialize();
    });

    it('should add user', () => {
      const user = userService.createUser('test@example.com', 'Test User');
      userService.addUser(user);

      expect(userService.getAllUsers()).toHaveLength(2); // Admin user + new user
      expect(userService.getUserById('test@example.com')).toBe(user);
      expect(mockCache.delete).toHaveBeenCalledWith('user:id:test@example.com');
      expect(mockCache.delete).toHaveBeenCalledWith('user:email:test@example.com');
    });

    it('should get user by ID from cache first', () => {
      const user = userService.createUser('test@example.com', 'Test User');
      mockCache.get.mockReturnValue(user);

      const result = userService.getUserById('test@example.com');

      expect(result).toBe(user);
      expect(mockCache.get).toHaveBeenCalledWith('user:id:test@example.com');
    });

    it('should get user by email', () => {
      const user = userService.createUser('test@example.com', 'Test User');
      userService.addUser(user);

      const result = userService.getUserByEmail('test@example.com');

      expect(result).toBe(user);
    });

    it('should get user by username', () => {
      const user = userService.createUser('test@example.com', 'Test User');
      userService.addUser(user);

      const result = userService.getUserByUsername('Test User');

      expect(result).toBe(user);
    });

    it('should update user', () => {
      const user = userService.createUser('test@example.com', 'Test User');
      userService.addUser(user);

      userService.updateUser('test@example.com', { name: 'Updated Name' });

      const updatedUser = userService.getUserById('test@example.com');
      expect(updatedUser?.name).toBe('Updated Name');
      expect(updatedUser?.updatedAt).toBeInstanceOf(Date);
    });

    it('should handle email change in updateUser', () => {
      const user = userService.createUser('old@example.com', 'Test User');
      userService.addUser(user);

      userService.updateUser('old@example.com', { email: 'new@example.com' });

      expect(userService.getUserById('old@example.com')).toBeUndefined();
      expect(userService.getUserById('new@example.com')).toBeDefined();
      expect(userService.getUserById('new@example.com')?.email).toBe('new@example.com');
    });

    it('should delete user', () => {
      const user = userService.createUser('test@example.com', 'Test User');
      userService.addUser(user);

      userService.deleteUser('test@example.com');

      expect(userService.getUserById('test@example.com')).toBeUndefined();
      expect(userService.getAllUsers()).toHaveLength(1); // Admin user remains
    });

    it('should update user config', async () => {
      const user = userService.createUser('test@example.com', 'Test User');
      userService.addUser(user);

      const newConfig: Partial<UserConfig> = {
        schedule: {
          morningReminderTime: '08:00',
          eveningReminderTime: '20:00',
          timezone: 'UTC'
        }
      };

      const success = await userService.updateUserConfig('test@example.com', newConfig);

      expect(success).toBe(true);
      const updatedUser = userService.getUserById('test@example.com');
      expect(updatedUser?.config.schedule.morningReminderTime).toBe('08:00');
      expect(mockFileUtils.safeWriteJsonFile).toHaveBeenCalled();
    });

    it('should return false when updating config for non-existent user', async () => {
      const success = await userService.updateUserConfig('nonexistent@example.com', {});

      expect(success).toBe(false);
    });
  });

  describe('user queries', () => {
    beforeEach(async () => {
      mockFileUtils.safeReadJsonFile.mockResolvedValue([]);
      await userService.initialize();

      // Add test users
      const activeUser = userService.createUser('active@example.com', 'Active User');
      const inactiveUser = userService.createUser('inactive@example.com', 'Inactive User');
      inactiveUser.isActive = false;

      userService.addUser(activeUser);
      userService.addUser(inactiveUser);
    });

    it('should get all users', () => {
      const users = userService.getAllUsers();
      expect(users).toHaveLength(3); // Admin user + 2 test users
    });

    it('should get only active users', () => {
      const activeUsers = userService.getActiveUsers();
      expect(activeUsers).toHaveLength(2); // Admin user + active test user
      const activeEmails = activeUsers.map(u => u.email);
      expect(activeEmails).toContain('active@example.com');
      expect(activeEmails).toContain('admin@test.com');
    });

    it('should get user stats', () => {
      const stats = userService.getStats();
      expect(stats.total).toBe(3); // Admin user + 2 test users
      expect(stats.active).toBe(2); // Admin user + active test user
      expect(stats.inactive).toBe(1); // Inactive test user
    });

    it('should get cache stats', () => {
      const stats = userService.getCacheStats();
      expect(stats).toEqual({
        size: 0,
        hits: 0,
        misses: 0,
        hitRate: 0,
        memoryUsage: 0
      });
      expect(mockCache.getStats).toHaveBeenCalled();
    });
  });

  describe('convenience methods', () => {
    beforeEach(async () => {
      mockFileUtils.safeReadJsonFile.mockResolvedValue([]);
      await userService.initialize();
    });

    it('should add user by info', async () => {
      const user = await userService.addUserByInfo('testuser', 'test@example.com', 'Test User');

      expect(user.email).toBe('test@example.com');
      expect(user.name).toBe('Test User');
      expect(userService.getAllUsers()).toHaveLength(2); // Admin user + new user
    });

    it('should remove user by identifier', async () => {
      const user = userService.createUser('test@example.com', 'Test User');
      userService.addUser(user);

      const success = await userService.removeUser('test@example.com');

      expect(success).toBe(true);
      expect(userService.getAllUsers()).toHaveLength(1); // Admin user remains
    });

    it('should return false when removing non-existent user', async () => {
      const success = await userService.removeUser('nonexistent@example.com');

      expect(success).toBe(false);
    });
  });

  describe('file operations', () => {
    it('should save users to file', async () => {
      const user = userService.createUser('test@example.com', 'Test User');
      userService.addUser(user);

      await userService.saveToFile();

      expect(mockFileUtils.withFileLock).toHaveBeenCalledWith('/tmp/test-users.json', expect.any(Function));
      expect(mockFileUtils.safeWriteJsonFile).toHaveBeenCalledWith(
        '/tmp/test-users.json',
        expect.arrayContaining([
          expect.objectContaining({
            id: 'test@example.com',
            email: 'test@example.com',
            name: 'Test User',
            createdAt: expect.any(String),
            updatedAt: expect.any(String)
          })
        ]),
        { backup: true }
      );
    });

    it('should handle save errors', async () => {
      mockFileUtils.safeWriteJsonFile.mockRejectedValue(new Error('Save failed'));

      await expect(userService.saveToFile()).rejects.toThrow('Save failed');
    });
  });

  describe('cache integration', () => {
    beforeEach(async () => {
      mockFileUtils.safeReadJsonFile.mockResolvedValue([]);
      await userService.initialize();
    });

    it('should cache user when found', () => {
      const user = userService.createUser('test@example.com', 'Test User');
      userService.addUser(user);
      mockCache.get.mockReturnValue(undefined); // Not in cache initially

      const result = userService.getUserById('test@example.com');

      expect(result).toBe(user);
      expect(mockCache.set).toHaveBeenCalledWith('user:id:test@example.com', user, 10 * 60 * 1000);
    });

    it('should invalidate cache when user is updated', () => {
      const user = userService.createUser('test@example.com', 'Test User');
      userService.addUser(user);

      userService.updateUser('test@example.com', { name: 'Updated Name' });

      expect(mockCache.delete).toHaveBeenCalledWith('user:id:test@example.com');
      expect(mockCache.delete).toHaveBeenCalledWith('user:email:test@example.com');
    });
  });
});