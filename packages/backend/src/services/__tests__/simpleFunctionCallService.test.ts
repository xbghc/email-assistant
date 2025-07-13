import SimpleFunctionCallService from '../ai/functionCall/simpleFunctionCallService';
import UserService from '../user/userService';
import { User, UserRole } from '../../models/User';

// Mock UserService
jest.mock('../user/userService');

const MockedUserService = UserService as jest.MockedClass<typeof UserService>;

describe('SimpleFunctionCallService', () => {
  let service: SimpleFunctionCallService;
  let mockUserServiceInstance: jest.Mocked<UserService>;

  const mockUser: User = {
    id: 'user123',
    name: 'Test User',
    email: 'test@example.com',
    role: UserRole.USER,
    config: {
      schedule: {
        morningReminderTime: '08:00',
        eveningReminderTime: '20:00',
        timezone: 'Asia/Shanghai'
      },
      language: 'zh'
    },
    isActive: true,
    emailVerified: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockAdminUser: User = {
    ...mockUser,
    id: 'admin123',
    email: 'admin@example.com',
    role: UserRole.ADMIN,
  };

  beforeEach(() => {
    // Create a partial mock of the UserService instance
    mockUserServiceInstance = {
      initialize: jest.fn(),
      updateUserConfig: jest.fn(),
      getUserByEmail: jest.fn(),
      getUserById: jest.fn().mockReturnValue(mockUser),
    } as unknown as jest.Mocked<UserService>;

    MockedUserService.mockImplementation(() => mockUserServiceInstance);
    service = new SimpleFunctionCallService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize user service', async () => {
      await service.initialize();
      expect(mockUserServiceInstance.initialize).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleFunctionCall', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should handle update_reminder_times function', async () => {
      const args = {
        morningTime: '08:00',
        eveningTime: '20:00'
      };

      mockUserServiceInstance.updateUserConfig.mockResolvedValue(true);

      const result = await service.handleFunctionCall('update_reminder_times', args, 'user123');

      expect(result.success).toBe(true);
      expect(result.message).toContain('提醒时间已更新');
      expect(mockUserServiceInstance.updateUserConfig).toHaveBeenCalledWith(
        'user123',
        expect.objectContaining({
          schedule: expect.objectContaining({
            morningReminderTime: '08:00',
            eveningReminderTime: '20:00'
          })
        })
      );
    });

    it('should handle update_reminder_times with partial args', async () => {
      const args = {
        morningTime: '09:00'
      };

      mockUserServiceInstance.updateUserConfig.mockResolvedValue(true);

      const result = await service.handleFunctionCall('update_reminder_times', args, 'user123');

      expect(result.success).toBe(true);
      expect(mockUserServiceInstance.updateUserConfig).toHaveBeenCalledWith(
        'user123',
        expect.objectContaining({
          schedule: expect.objectContaining({
            morningReminderTime: '09:00',
            eveningReminderTime: '20:00' // Should keep existing value
          })
        })
      );
    });

    it('should handle update_reminder_times without userId', async () => {
      const args = {
        morningTime: '08:00',
        eveningTime: '20:00'
      };

      const result = await service.handleFunctionCall('update_reminder_times', args);

      expect(result.success).toBe(false);
      expect(result.message).toContain('需要用户身份验证才能修改提醒时间');
    });

    it('should handle mark_emails_read function', async () => {
      // Mock admin user for this test
      mockUserServiceInstance.getUserById.mockReturnValue(mockAdminUser);
      
      const args = {
        markAll: true
      };

      const result = await service.handleFunctionCall('mark_emails_read', args, 'admin123');

      expect(result.success).toBe(true);
      expect(result.message).toContain('已标记');
    });

    it('should handle get_user_config function', async () => {
      mockUserServiceInstance.getUserById.mockReturnValue(mockUser);

      const result = await service.handleFunctionCall('get_user_config', {}, 'user123');

      expect(result.success).toBe(true);
      expect(result.message).toContain('08:00');
      expect(result.message).toContain('20:00');
      expect(mockUserServiceInstance.getUserById).toHaveBeenCalledWith('user123');
    });

    it('should handle get_user_config without userId', async () => {
      const result = await service.handleFunctionCall('get_user_config', {});

      expect(result.success).toBe(false);
      expect(result.message).toContain('需要用户身份验证才能查看配置');
    });

    it('should handle get_user_config for non-existent user', async () => {
      mockUserServiceInstance.getUserById.mockReturnValue(undefined);

      const result = await service.handleFunctionCall('get_user_config', {}, 'nonexistent');

      expect(result.success).toBe(false);
      expect(result.message).toContain('用户未找到');
    });

    it('should handle unknown function', async () => {
      const result = await service.handleFunctionCall('unknown_function', {});

      expect(result.success).toBe(false);
      expect(result.message).toContain('未知的功能');
    });

    it('should handle errors gracefully', async () => {
      const args = {
        morningTime: '08:00'
      };

      // Mock getUserById to throw an error to trigger the catch block
      mockUserServiceInstance.getUserById.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = await service.handleFunctionCall('update_reminder_times', args, 'user123');

      expect(result.success).toBe(false);
      expect(result.message).toBe('功能执行失败，请稍后重试');
    });
  });

  describe('time format validation in handleFunctionCall', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should handle invalid time format', async () => {
      const invalidArgs = {
        morningTime: '25:00', // Invalid hour
      };

      const result = await service.handleFunctionCall('update_reminder_times', invalidArgs, 'user123');
      expect(result.success).toBe(false);
      expect(result.message).toContain('时间格式无效');
    });

    it('should handle invalid evening time format', async () => {
      const invalidArgs = {
        eveningTime: '08:60', // Invalid minutes
      };

      const result = await service.handleFunctionCall('update_reminder_times', invalidArgs, 'user123');
      expect(result.success).toBe(false);
      expect(result.message).toContain('时间格式无效');
    });
  });
});