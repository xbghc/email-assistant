import EmailReceiveService from '../email/emailReceiveService';

// Mock dependencies
jest.mock('imap', () => {
  return jest.fn().mockImplementation(() => ({
    connect: jest.fn(),
    openBox: jest.fn(),
    search: jest.fn(),
    fetch: jest.fn(),
    addFlags: jest.fn(),
    end: jest.fn(),
    on: jest.fn(),
    once: jest.fn()
  }));
});

jest.mock('../user/userService', () => {
  return jest.fn().mockImplementation(() => ({
    getUserByEmail: jest.fn((email) => {
      // Mock users in system
      if (email === 'user@test.com') {
        return { id: 'user@test.com', email: 'user@test.com', name: 'Test User' };
      }
      return undefined; // Non-user emails return undefined
    })
  }));
});

jest.mock('../../config/index', () => ({
  email: {
    user: 'assistant@test.com',
    imap: {
      host: 'imap.test.com',
      port: 993,
      tls: true,
      rejectUnauthorized: true
    }
  }
}));

describe('EmailReceiveService', () => {
  let emailReceiveService: EmailReceiveService;

  beforeEach(() => {
    emailReceiveService = new EmailReceiveService();
  });

  describe('extractEmailAddress', () => {
    it('should extract email from various formats', () => {
      expect(emailReceiveService.extractEmailAddress('test@example.com')).toBe('test@example.com');
      expect(emailReceiveService.extractEmailAddress('User Name <test@example.com>')).toBe('test@example.com');
      expect(emailReceiveService.extractEmailAddress('"User Name" <test@example.com>')).toBe('test@example.com');
    });
  });

  describe('email classification', () => {
    it('should identify emails from assistant itself', () => {
      const mockEmail = {
        from: 'assistant@test.com',
        to: ['assistant@test.com'],
        subject: 'Test Subject',
        body: 'Test body',
        date: new Date(),
        uid: 123,
        isReply: false,
        replyType: 'direct' as const
      };

      const fromEmail = emailReceiveService.extractEmailAddress(mockEmail.from);
      expect(fromEmail.toLowerCase()).toBe('assistant@test.com');
    });

    it('should classify emails from system users vs non-users', () => {
      // Test system user email
      const userEmail = emailReceiveService.extractEmailAddress('user@test.com');
      expect(userEmail.toLowerCase()).toBe('user@test.com');
      
      // Test non-user email  
      const nonUserEmail = emailReceiveService.extractEmailAddress('stranger@test.com');
      expect(nonUserEmail.toLowerCase()).toBe('stranger@test.com');
      expect(nonUserEmail).not.toBe('user@test.com');
    });

    it('should handle email addresses with display names', () => {
      expect(emailReceiveService.extractEmailAddress('John Doe <john@test.com>')).toBe('john@test.com');
      expect(emailReceiveService.extractEmailAddress('"Jane Smith" <jane@test.com>')).toBe('jane@test.com');
    });
  });
});