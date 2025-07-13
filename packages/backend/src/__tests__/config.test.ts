import { validateConfig } from '../config/index';

describe('Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // 重置环境变量
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('validateConfig', () => {
    it('should pass with valid configuration', () => {
      process.env.EMAIL_USER = 'test@example.com';
      process.env.EMAIL_PASS = 'password';
      process.env.ADMIN_EMAIL = 'admin@example.com';
      process.env.OPENAI_API_KEY = 'sk-test';
      process.env.AI_PROVIDER = 'openai';

      expect(() => validateConfig()).not.toThrow();
    });

    it('should throw error when email credentials are missing', () => {
      delete process.env.EMAIL_USER;
      delete process.env.EMAIL_PASS;
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;
      process.env.ADMIN_EMAIL = 'admin@example.com';
      process.env.OPENAI_API_KEY = 'sk-test';
      process.env.AI_PROVIDER = 'openai';
      process.env.NODE_ENV = 'development'; // 确保不是测试模式

      expect(() => validateConfig()).toThrow(/Email credentials/);
    });

    it('should throw error when AI API key is missing', () => {
      process.env.EMAIL_USER = 'test@example.com';
      process.env.EMAIL_PASS = 'password';
      process.env.ADMIN_EMAIL = 'admin@example.com';
      process.env.AI_PROVIDER = 'openai';
      delete process.env.OPENAI_API_KEY;
      process.env.NODE_ENV = 'development'; // 确保不是测试模式

      expect(() => validateConfig()).toThrow(/OpenAI API key/);
    });
  });
});