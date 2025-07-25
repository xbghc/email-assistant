import fs from 'fs/promises';
import ContextService from '../reports/contextService';
import * as fileUtils from '../../utils/fileUtils';

// Mock dependencies
jest.mock('fs/promises');
jest.mock('../../utils/fileUtils');

// Mock AIService
jest.mock('../ai/aiService', () => {
  return jest.fn().mockImplementation(() => ({
    compressContext: jest.fn().mockResolvedValue('Compressed context summary')
  }));
});

const mockFs = fs as jest.Mocked<typeof fs>;
const mockFileUtils = fileUtils as jest.Mocked<typeof fileUtils>;

describe('ContextService', () => {
  let contextService: ContextService;
  const testContextFile = '/tmp/test-context.json';

  beforeEach(() => {
    // 使用假定时器避免真实的异步操作
    jest.useFakeTimers();
    jest.clearAllMocks();
    
    // Setup default mocks
    mockFs.access.mockResolvedValue(undefined);
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFileUtils.safeReadJsonFile.mockResolvedValue({});
    mockFileUtils.safeWriteJsonFile.mockResolvedValue(undefined);
    
    contextService = new ContextService();
    // @ts-expect-error - Override the private contextFile for testing
    contextService.contextFile = testContextFile;
  });

  afterEach(() => {
    // 清理所有 mock 和定时器
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('initialization', () => {
    it('should initialize with empty context when file does not exist', async () => {
      mockFileUtils.safeReadJsonFile.mockResolvedValue({});

      await contextService.initialize();

      expect(mockFileUtils.safeReadJsonFile).toHaveBeenCalledWith(testContextFile, {});
    });

    it('should load existing context from file', async () => {
      // Test by adding data directly and verifying it loads correctly
      const testDate = new Date();
      
      // Create a new service instance to test loading
      const newContextService = new ContextService();
      // @ts-expect-error - Override the private contextFile for testing  
      newContextService.contextFile = testContextFile;
      
      // Mock the file read to return the data we expect
      const mockData = {
        'user1': [
          {
            id: '1',
            timestamp: testDate.toISOString(),
            type: 'conversation',
            content: 'Test content',
            metadata: { test: true }
          }
        ]
      };
      
      mockFileUtils.safeReadJsonFile.mockResolvedValue(mockData);
      
      await newContextService.initialize();
      
      const context = await newContextService.getRecentContext(365, 'user1');
      expect(context).toHaveLength(1);
      expect(context[0]?.content).toBe('Test content');
      expect(context[0]?.timestamp).toBeInstanceOf(Date);
    });

    it('should handle legacy format (array instead of object)', async () => {
      const testDate = new Date();
      const mockData = [
        {
          id: '1',
          timestamp: testDate.toISOString(),
          type: 'conversation',
          content: 'Legacy content'
        }
      ];

      // Create new service instance
      const newContextService = new ContextService();
      // @ts-expect-error - Override the private contextFile for testing
      newContextService.contextFile = testContextFile;
      
      // Mock file read to return legacy format (array)
      mockFileUtils.safeReadJsonFile.mockResolvedValue(mockData);
      
      await newContextService.initialize();

      // Legacy format should be loaded as 'admin' user context
      const context = await newContextService.getRecentContext(365, 'admin');
      expect(context).toHaveLength(1);
      expect(context[0]?.content).toBe('Legacy content');
      expect(context[0]?.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('addEntry', () => {
    beforeEach(async () => {
      await contextService.initialize();
    });

    it('should add entry and save to file', async () => {
      await contextService.addEntry(
        'conversation',
        'Test message',
        { source: 'test' },
        'user1'
      );

      const context = await contextService.getRecentContext(10, 'user1');
      expect(context).toHaveLength(1);
      expect(context[0]?.content).toBe('Test message');
      expect(context[0]?.type).toBe('conversation');
      expect(context[0]?.metadata).toEqual({ source: 'test' });
    });

    it('should use admin as default userId', async () => {
      await contextService.addEntry('conversation', 'Admin message');

      const context = await contextService.getRecentContext(10, 'admin');
      expect(context).toHaveLength(1);
      expect(context[0]?.content).toBe('Admin message');
    });

    it('should handle save errors gracefully', async () => {
      mockFileUtils.safeWriteJsonFile.mockRejectedValue(new Error('Write failed'));

      // Should not throw even if save fails
      await expect(contextService.addEntry('conversation', 'Test message')).resolves.not.toThrow();
      
      // Entry should still be added to memory even if save fails
      const context = await contextService.getRecentContext(10, 'admin');
      expect(context).toHaveLength(1);
      expect(context[0]?.content).toBe('Test message');
    });
  });

  describe('getRecentContext', () => {
    beforeEach(async () => {
      await contextService.initialize();

      // Add some test entries
      await contextService.addEntry('conversation', 'Message 1', {}, 'user1');
      await contextService.addEntry('schedule', 'Schedule 1', {}, 'user1');
      await contextService.addEntry('conversation', 'Message 2', {}, 'user1');
      await contextService.addEntry('conversation', 'Message 3', {}, 'user2');
    });

    it('should return recent entries for specific user', async () => {
      const context = await contextService.getRecentContext(10, 'user1');
      
      expect(context).toHaveLength(3);
      expect(context.map(e => e.content)).toEqual([
        'Message 1',
        'Schedule 1', 
        'Message 2'
      ]);
    });

    it('should filter entries by date range', async () => {
      // Test with 7 days (should return recent entries)
      const context = await contextService.getRecentContext(7, 'user1');
      
      // All entries should be returned since they were added recently
      expect(context).toHaveLength(3);
      expect(context.map(e => e.content)).toEqual([
        'Message 1',
        'Schedule 1', 
        'Message 2'
      ]);
    });

    it('should return empty array for non-existent user', async () => {
      const context = await contextService.getRecentContext(10, 'nonexistent');
      expect(context).toHaveLength(0);
    });

    it('should use admin as default userId', async () => {
      await contextService.addEntry('conversation', 'Admin message', {}, 'admin');
      
      const context = await contextService.getRecentContext(10);
      expect(context).toHaveLength(1);
      expect(context[0]?.content).toBe('Admin message');
    });
  });

  describe('getContextByType', () => {
    beforeEach(async () => {
      await contextService.initialize();

      await contextService.addEntry('conversation', 'Conv 1', {}, 'user1');
      await contextService.addEntry('schedule', 'Schedule 1', {}, 'user1');
      await contextService.addEntry('work_summary', 'Work 1', {}, 'user1');
      await contextService.addEntry('conversation', 'Conv 2', {}, 'user1');
    });

    it('should return entries of specific type', async () => {
      const conversations = await contextService.getContextByType('conversation', 10, 'user1');
      
      expect(conversations).toHaveLength(2);
      expect(conversations.map(e => e.content)).toEqual(['Conv 1', 'Conv 2']);
    });

    it('should limit results', async () => {
      const conversations = await contextService.getContextByType('conversation', 1, 'user1');
      
      expect(conversations).toHaveLength(1);
      expect(conversations[0]?.content).toBe('Conv 2');
    });

    it('should return empty array for non-matching type', async () => {
      const feedback = await contextService.getContextByType('feedback', 10, 'user1');
      expect(feedback).toHaveLength(0);
    });
  });

  describe('context compression', () => {
    beforeEach(async () => {
      await contextService.initialize();
    });

    it('should check if compression is needed', async () => {
      // @ts-expect-error - Accessing private method for testing
      const checkMethod = contextService.shouldCompress.bind(contextService);
      
      // Add entries with shorter content that won't trigger auto-compression
      await contextService.addEntry('conversation', 'x'.repeat(1500), {}, 'user1');
      await contextService.addEntry('conversation', 'x'.repeat(1500), {}, 'user1');
      await contextService.addEntry('conversation', 'x'.repeat(1500), {}, 'user1');
      
      // Verify entries were added (4500 chars < 6000 threshold, no auto-compression)
      const context = await contextService.getRecentContext(7, 'user1');
      expect(context).toHaveLength(3);
      
      // Should not need compression yet (4500 chars < 6000 threshold)
      expect(checkMethod('user1')).toBe(false);
      
      // Add one more entry to exceed threshold
      await contextService.addEntry('conversation', 'x'.repeat(2000), {}, 'user1');
      
      // Now should need compression (6500 chars > 6000 threshold)
      expect(checkMethod('user1')).toBe(true);
      
      // User with no context should not need compression
      expect(checkMethod('user2')).toBe(false);
    });

    it('should maintain context after compression', async () => {
      // This is more of an integration test for compression
      // Just verify that the service maintains functionality
      await contextService.addEntry('conversation', 'Test entry', {}, 'user1');
      
      const context = await contextService.getRecentContext(7, 'user1');
      expect(context).toHaveLength(1);
      expect(context[0]?.content).toBe('Test entry');
    });
  });
});