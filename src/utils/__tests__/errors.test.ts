import {
  EmailAssistantError,
  ErrorCode,
  ConfigError,
  EmailError,
  AIServiceError,
  UserError,
  DataError,
  isEmailAssistantError,
  formatError,
  createConfigError,
  createEmailError,
  withRetry
} from '../errors';

describe('Error Types', () => {
  describe('EmailAssistantError', () => {
    it('should create error with basic properties', () => {
      const error = new EmailAssistantError(
        ErrorCode.CONFIG_VALIDATION_FAILED,
        'Test error message'
      );

      expect(error.code).toBe(ErrorCode.CONFIG_VALIDATION_FAILED);
      expect(error.message).toBe('Test error message');
      expect(error.name).toBe('EmailAssistantError');
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    it('should create error with context', () => {
      const context = { userId: '123', action: 'test' };
      const error = new EmailAssistantError(
        ErrorCode.USER_NOT_FOUND,
        'User not found',
        context
      );

      expect(error.context).toEqual(context);
    });

    it('should create error with cause', () => {
      const cause = new Error('Original error');
      const error = new EmailAssistantError(
        ErrorCode.UNKNOWN_ERROR,
        'Wrapped error',
        undefined,
        cause
      );

      expect(error.stack).toContain('Caused by:');
    });

    it('should serialize to JSON correctly', () => {
      const error = new EmailAssistantError(
        ErrorCode.EMAIL_SEND_FAILED,
        'Send failed',
        { recipient: 'test@example.com' }
      );

      const json = error.toJSON();
      expect(json.code).toBe(ErrorCode.EMAIL_SEND_FAILED);
      expect(json.message).toBe('Send failed');
      expect(json.context).toEqual({ recipient: 'test@example.com' });
      expect(json.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('Specific Error Types', () => {
    it('should create ConfigError', () => {
      const error = new ConfigError('Config invalid');
      expect(error).toBeInstanceOf(EmailAssistantError);
      expect(error.name).toBe('ConfigError');
      expect(error.code).toBe(ErrorCode.CONFIG_VALIDATION_FAILED);
    });

    it('should create EmailError', () => {
      const error = new EmailError(
        ErrorCode.EMAIL_CONNECTION_FAILED,
        'Connection failed'
      );
      expect(error).toBeInstanceOf(EmailAssistantError);
      expect(error.name).toBe('EmailError');
      expect(error.code).toBe(ErrorCode.EMAIL_CONNECTION_FAILED);
    });

    it('should create AIServiceError', () => {
      const error = new AIServiceError(
        ErrorCode.AI_REQUEST_FAILED,
        'AI request failed'
      );
      expect(error).toBeInstanceOf(EmailAssistantError);
      expect(error.name).toBe('AIServiceError');
      expect(error.code).toBe(ErrorCode.AI_REQUEST_FAILED);
    });

    it('should create UserError', () => {
      const error = new UserError(
        ErrorCode.USER_NOT_FOUND,
        'User not found'
      );
      expect(error).toBeInstanceOf(EmailAssistantError);
      expect(error.name).toBe('UserError');
      expect(error.code).toBe(ErrorCode.USER_NOT_FOUND);
    });

    it('should create DataError', () => {
      const error = new DataError(
        ErrorCode.DATA_SAVE_FAILED,
        'Save failed'
      );
      expect(error).toBeInstanceOf(EmailAssistantError);
      expect(error.name).toBe('DataError');
      expect(error.code).toBe(ErrorCode.DATA_SAVE_FAILED);
    });
  });

  describe('Utility Functions', () => {
    it('should identify EmailAssistantError', () => {
      const customError = new EmailAssistantError(
        ErrorCode.UNKNOWN_ERROR,
        'Test'
      );
      const standardError = new Error('Standard error');

      expect(isEmailAssistantError(customError)).toBe(true);
      expect(isEmailAssistantError(standardError)).toBe(false);
    });

    it('should format EmailAssistantError', () => {
      const error = new EmailAssistantError(
        ErrorCode.EMAIL_SEND_FAILED,
        'Send failed',
        { recipient: 'test@example.com' }
      );

      const formatted = formatError(error);
      expect(formatted).toContain('[EMAIL_SEND_FAILED]');
      expect(formatted).toContain('Send failed');
      expect(formatted).toContain('test@example.com');
    });

    it('should format standard Error', () => {
      const error = new Error('Standard error');
      const formatted = formatError(error);
      expect(formatted).toBe('Standard error');
    });

    it('should create ConfigError using factory', () => {
      const error = createConfigError('Test config error', { key: 'value' });
      expect(error).toBeInstanceOf(ConfigError);
      expect(error.message).toBe('Test config error');
      expect(error.context).toEqual({ key: 'value' });
    });

    it('should create EmailError using factory', () => {
      const error = createEmailError(
        ErrorCode.EMAIL_PARSING_FAILED,
        'Parse failed',
        { messageId: '123' }
      );
      expect(error).toBeInstanceOf(EmailError);
      expect(error.code).toBe(ErrorCode.EMAIL_PARSING_FAILED);
      expect(error.message).toBe('Parse failed');
      expect(error.context).toEqual({ messageId: '123' });
    });
  });

  describe('withRetry', () => {
    it('should succeed on first attempt', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      
      const result = await withRetry(operation, 3, 100);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Attempt 1 failed'))
        .mockRejectedValueOnce(new Error('Attempt 2 failed'))
        .mockResolvedValue('success');
      
      const result = await withRetry(operation, 3, 10);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should throw EmailAssistantError after max retries', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Always fails'));
      
      await expect(withRetry(operation, 2, 10)).rejects.toThrow(EmailAssistantError);
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should respect shouldRetry function', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Should not retry'));
      const shouldRetry = jest.fn().mockReturnValue(false);
      
      await expect(withRetry(operation, 3, 10, shouldRetry)).rejects.toThrow('Should not retry');
      expect(operation).toHaveBeenCalledTimes(1);
      expect(shouldRetry).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});