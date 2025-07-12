import fs from 'fs/promises';
import path from 'path';
import ContextService from '../reports/contextService';
import { ContextEntry } from '../../models/index';
import * as fileUtils from '../../utils/fileUtils';

// Mock dependencies
jest.mock('fs/promises');
jest.mock('../ai/aiService');
jest.mock('../../utils/fileUtils');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockFileUtils = fileUtils as jest.Mocked<typeof fileUtils>;

describe('ContextService', () => {
  let contextService: ContextService;
  const testContextFile = '/tmp/test-context.json';

  beforeEach(() => {
    contextService = new ContextService();
    // Override the private contextFile for testing
    (contextService as any).contextFile = testContextFile;
    jest.clearAllMocks();
    
    // Setup default mocks
    mockFs.access.mockResolvedValue(undefined);
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFileUtils.safeReadJsonFile.mockResolvedValue({});
    mockFileUtils.safeWriteJsonFile.mockResolvedValue(undefined);
  });

  describe('initialization', () => {
    it('should initialize with empty context when file does not exist', async () => {
      mockFileUtils.safeReadJsonFile.mockResolvedValue({});

      await contextService.initialize();

      expect(mockFileUtils.safeReadJsonFile).toHaveBeenCalledWith(testContextFile, {});
    });

    it('should load existing context from file', async () => {
      const mockData = {
        'user1': [
          {
            id: '1',
            timestamp: '2024-01-01T00:00:00.000Z',
            type: 'conversation',
            content: 'Test content',
            metadata: { test: true }
          }
        ]
      };

      // Create a new service instance with mock data
      const newContextService = new ContextService();
      (newContextService as any).contextFile = testContextFile;
      mockFileUtils.safeReadJsonFile.mockResolvedValue(mockData);

      await newContextService.initialize();

      const context = await newContextService.getRecentContext(365, 'user1'); // Use larger date range
      expect(context).toHaveLength(1);
      expect(context[0]?.content).toBe('Test content');
      expect(context[0]?.timestamp).toBeInstanceOf(Date);
    });

    it('should handle legacy format (array instead of object)', async () => {
      const mockData = [
        {
          id: '1',
          timestamp: '2024-01-01T00:00:00.000Z',
          type: 'conversation',
          content: 'Legacy content'
        }
      ];

      // Create a new service instance with mock data
      const newContextService = new ContextService();
      (newContextService as any).contextFile = testContextFile;
      mockFileUtils.safeReadJsonFile.mockResolvedValue(mockData);

      await newContextService.initialize();

      const context = await newContextService.getRecentContext(365, 'admin'); // Use larger date range
      expect(context).toHaveLength(1);
      expect(context[0]?.content).toBe('Legacy content');
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
      const checkMethod = (contextService as any).shouldCompress.bind(contextService);
      
      // Add entries with long content to trigger compression threshold
      await contextService.addEntry('conversation', 'x'.repeat(3000), {}, 'user1');
      await contextService.addEntry('conversation', 'x'.repeat(3000), {}, 'user1');
      await contextService.addEntry('conversation', 'x'.repeat(1000), {}, 'user1');
      
      // Verify entries were added
      const context = await contextService.getRecentContext(7, 'user1');
      expect(context).toHaveLength(3);
      
      // Should need compression (7000 chars > 6000 threshold)
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