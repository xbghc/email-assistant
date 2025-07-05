import SimpleFunctionCallService from '../simpleFunctionCallService';
import UserService from '../userService';

// Mock UserService
jest.mock('../userService');

const mockUserService = UserService as jest.MockedClass<typeof UserService>;

describe('SimpleFunctionCallService', () => {
  let service: SimpleFunctionCallService;
  let mockUserServiceInstance: jest.Mocked<UserService>;

  beforeEach(() => {
    mockUserServiceInstance = {
      initialize: jest.fn(),
      updateUserConfig: jest.fn(),
      getUserByEmail: jest.fn(),
      getUserById: jest.fn(),
    } as any;

    mockUserService.mockImplementation(() => mockUserServiceInstance);
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

      mockUserServiceInstance.updateUserConfig.mockResolvedValue(undefined);

      const result = await service.handleFunctionCall('update_reminder_times', args, 'user123');

      expect(result.success).toBe(true);
      expect(result.message).toContain('提醒时间已更新');
      expect(mockUserServiceInstance.updateUserConfig).toHaveBeenCalledWith(
        'user123',
        {
          morningReminderTime: '08:00',
          eveningReminderTime: '20:00'
        }
      );
    });

    it('should handle update_reminder_times with partial args', async () => {
      const args = {
        morningTime: '09:00'
      };

      mockUserServiceInstance.updateUserConfig.mockResolvedValue(undefined);

      const result = await service.handleFunctionCall('update_reminder_times', args, 'user123');

      expect(result.success).toBe(true);
      expect(mockUserServiceInstance.updateUserConfig).toHaveBeenCalledWith(
        'user123',
        {
          morningReminderTime: '09:00'
        }
      );
    });

    it('should handle update_reminder_times without userId', async () => {
      const args = {
        morningTime: '08:00',
        eveningTime: '20:00'
      };

      const result = await service.handleFunctionCall('update_reminder_times', args);

      expect(result.success).toBe(false);
      expect(result.message).toContain('用户ID未提供');
    });

    it('should handle mark_emails_read function', async () => {
      const args = {
        markAll: true
      };

      const result = await service.handleFunctionCall('mark_emails_read', args);

      expect(result.success).toBe(true);
      expect(result.message).toContain('邮件标记功能');
    });

    it('should handle get_user_config function', async () => {
      const mockUser = {
        id: 'user123',
        email: 'test@example.com',
        name: 'Test User',
        config: {
          morningReminderTime: '08:00',
          eveningReminderTime: '20:00'
        }
      };

      mockUserServiceInstance.getUserById.mockReturnValue(mockUser as any);

      const result = await service.handleFunctionCall('get_user_config', {}, 'user123');

      expect(result.success).toBe(true);
      expect(result.message).toContain('08:00');
      expect(result.message).toContain('20:00');
      expect(mockUserServiceInstance.getUserById).toHaveBeenCalledWith('user123');
    });

    it('should handle get_user_config without userId', async () => {
      const result = await service.handleFunctionCall('get_user_config', {});

      expect(result.success).toBe(false);
      expect(result.message).toContain('用户ID未提供');
    });

    it('should handle get_user_config for non-existent user', async () => {
      mockUserServiceInstance.getUserById.mockReturnValue(undefined);

      const result = await service.handleFunctionCall('get_user_config', {}, 'nonexistent');

      expect(result.success).toBe(false);
      expect(result.message).toContain('用户不存在');
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

      mockUserServiceInstance.updateUserConfig.mockRejectedValue(new Error('Database error'));

      const result = await service.handleFunctionCall('update_reminder_times', args, 'user123');

      expect(result.success).toBe(false);
      expect(result.message).toBe('功能执行失败，请稍后重试');
    });
  });

  describe('updateReminderTimes', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should validate time format', async () => {
      const updateMethod = (service as any).updateReminderTimes;
      
      const validArgs = {
        morningTime: '08:00',
        eveningTime: '20:30'
      };

      mockUserServiceInstance.updateUserConfig.mockResolvedValue(undefined);

      const result = await updateMethod(validArgs, 'user123');
      expect(result.success).toBe(true);
    });

    it('should handle invalid time format', async () => {
      const updateMethod = (service as any).updateReminderTimes;
      
      const invalidArgs = {
        morningTime: '25:00', // Invalid hour
        eveningTime: '20:00'
      };

      const result = await updateMethod(invalidArgs, 'user123');
      expect(result.success).toBe(false);
      expect(result.message).toContain('时间格式无效');
    });

    it('should handle empty args', async () => {
      const updateMethod = (service as any).updateReminderTimes;
      
      const result = await updateMethod({}, 'user123');
      expect(result.success).toBe(false);
      expect(result.message).toContain('至少提供一个时间参数');
    });
  });

  describe('time validation', () => {
    it('should validate correct time format', () => {
      const validateMethod = (service as any).isValidTimeFormat;
      
      expect(validateMethod('08:00')).toBe(true);
      expect(validateMethod('23:59')).toBe(true);
      expect(validateMethod('00:00')).toBe(true);
      expect(validateMethod('12:30')).toBe(true);
    });

    it('should reject invalid time format', () => {
      const validateMethod = (service as any).isValidTimeFormat;
      
      expect(validateMethod('24:00')).toBe(false);
      expect(validateMethod('08:60')).toBe(false);
      expect(validateMethod('8:00')).toBe(false); // Missing leading zero
      expect(validateMethod('08-00')).toBe(false); // Wrong separator
      expect(validateMethod('invalid')).toBe(false);
      expect(validateMethod('')).toBe(false);
    });
  });
});