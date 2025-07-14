import EmailService from '../email/emailService';
import nodemailer from 'nodemailer';

// Mock nodemailer
jest.mock('nodemailer', () => ({
  __esModule: true,
  default: {
    createTransport: jest.fn()
  }
}));

// Mock dependencies
jest.mock('../email/emailContentManager', () => {
  return jest.fn().mockImplementation(() => ({
    optimizeEmailContent: jest.fn((content: string) => content),
    getContentStats: jest.fn(() => ({
      length: 100,
      needsOptimization: false
    }))
  }));
});

jest.mock('../email/emailStatsService', () => {
  return jest.fn().mockImplementation(() => ({
    initialize: jest.fn(),
    recordEmailSent: jest.fn(),
    getEmailStats: jest.fn(() => ({})),
    getEmailTrendData: jest.fn(() => ([]))
  }));
});
jest.mock('../../config/index', () => ({
  email: {
    user: 'test@example.com',
    pass: 'testpass',
    name: 'Test User',
    smtp: {
      host: 'test.smtp.com',
      port: 587,
      secure: false
    },
    imap: {
      host: 'test.imap.com',
      port: 993,
      tls: true,
      rejectUnauthorized: true,
      checkIntervalMs: 30000
    },
    forwarding: {
      enabled: true,
      markAsRead: true
    },
    admin: {
      email: 'admin@example.com'
    }
  },
  ai: {
    provider: 'openai'
  }
}));

const mockTransporter = {
  sendMail: jest.fn(),
  verify: jest.fn(),
  close: jest.fn()
};

describe('EmailService', () => {
  let emailService: EmailService;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    
    // Setup nodemailer mock
    (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);
    mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-message-id' });
    mockTransporter.verify.mockResolvedValue(true);
    
    emailService = new EmailService();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('initialization', () => {
    it('should create transporter with correct config', () => {
      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: 'test.smtp.com',
        port: 587,
        secure: false,
        pool: true,
        maxConnections: 3,
        maxMessages: 10,
        connectionTimeout: 30000,
        socketTimeout: 30000,
        auth: {
          user: 'test@example.com',
          pass: 'testpass'
        }
      });
    });
  });

  describe('verifyConnection', () => {
    it('should return true when connection is successful', async () => {
      mockTransporter.verify.mockResolvedValue(true);
      
      const result = await emailService.verifyConnection();
      
      expect(result).toBe(true);
      expect(mockTransporter.verify).toHaveBeenCalledTimes(1);
    });

    it('should return false when connection fails', async () => {
      mockTransporter.verify.mockRejectedValue(new Error('Connection failed'));
      
      const result = await emailService.verifyConnection();
      
      expect(result).toBe(false);
    });
  });

  describe('sendEmail', () => {
    it('should send email successfully', async () => {
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-id' });
      
      await emailService.sendEmail('Test Subject', 'Test Content');
      
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: 'test@example.com',
        to: 'test@example.com',
        subject: 'Test Subject',
        text: 'Test Content'
      });
    });

    it('should send HTML email when isHtml is true', async () => {
      await emailService.sendEmail('Test Subject', '<h1>Test Content</h1>', true);
      
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: 'test@example.com',
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<h1>Test Content</h1>'
      });
    });

    it('should send email to custom recipient', async () => {
      await emailService.sendEmail('Test Subject', 'Test Content', false, 'custom@example.com');
      
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: 'test@example.com',
        to: 'custom@example.com',
        subject: 'Test Subject',
        text: 'Test Content'
      });
    });

    it('should queue email when immediate send fails', async () => {
      mockTransporter.sendMail.mockRejectedValue(new Error('SMTP error'));
      
      // Should not throw error, but queue for retry
      await expect(emailService.sendEmail('Test Subject', 'Test Content')).resolves.not.toThrow();
    });
  });

  describe('sendMorningReminder', () => {
    it('should send morning reminder with correct format', async () => {
      const scheduleContent = 'Today\'s schedule';
      const suggestions = 'Today\'s suggestions';
      
      await emailService.sendMorningReminder(scheduleContent, suggestions);
      
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining('📅'),
          text: expect.stringContaining(scheduleContent)
        })
      );
    });
  });

  describe('sendEveningReminder', () => {
    it('should send evening reminder with correct format', async () => {
      await emailService.sendEveningReminder();
      
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining('📝'),
          text: expect.stringContaining('现在是时候回顾您的一天了')
        })
      );
    });
  });

  describe('sendEmailToUser', () => {
    it('should send email to specific user', async () => {
      await emailService.sendEmailToUser('user@test.com', 'Test Subject', 'Test Content');
      
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: 'test@example.com',
        to: 'user@test.com',
        subject: 'Test Subject',
        text: 'Test Content'
      });
    });
  });

  describe('getServiceStatus', () => {
    it('should return service status', () => {
      const status = emailService.getServiceStatus();
      
      expect(status).toEqual({
        isConnected: false, // Initially false before verification
        queueLength: 0,
        circuitBreakerOpen: false, // Circuit breaker starts closed
        config: {
          smtpHost: 'test.smtp.com',
          smtpPort: 587,
          smtpUserConfigured: true,
          smtpPassConfigured: true,
          imapHost: 'test.imap.com',
          imapPort: 993,
          imapUserConfigured: true,
          imapPassConfigured: true
        },
        lastConnection: {
          timestamp: expect.any(Date),
          success: false
        }
      });
    });
  });

  describe('shutdown', () => {
    it('should shutdown gracefully', async () => {
      await emailService.shutdown();
      
      expect(mockTransporter.close).toHaveBeenCalledTimes(1);
    });
  });
});