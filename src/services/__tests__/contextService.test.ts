import fs from 'fs/promises';
import path from 'path';
import ContextService from '../contextService';
import { ContextEntry } from '../../models';

// Mock dependencies
jest.mock('fs/promises');
jest.mock('../aiService');

const mockFs = fs as jest.Mocked<typeof fs>;

describe('ContextService', () => {
  let contextService: ContextService;
  const testContextFile = '/tmp/test-context.json';

  beforeEach(() => {
    contextService = new ContextService();
    // Override the private contextFile for testing
    (contextService as any).contextFile = testContextFile;
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with empty context when file does not exist', async () => {
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' } as any);
      mockFs.writeFile.mockResolvedValue(undefined);

      await contextService.initialize();

      expect(mockFs.readFile).toHaveBeenCalledWith(testContextFile, 'utf-8');
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        testContextFile,
        '{}',
        'utf-8'
      );
    });

    it('should load existing context from file', async () => {
      const mockData = JSON.stringify({
        'user1': [
          {
            id: '1',
            timestamp: '2024-01-01T00:00:00.000Z',
            type: 'conversation',
            content: 'Test content',
            metadata: { test: true }
          }
        ]
      });

      mockFs.readFile.mockResolvedValue(mockData);

      await contextService.initialize();

      const context = await contextService.getRecentContext(10, 'user1');
      expect(context).toHaveLength(1);
      expect(context[0]?.content).toBe('Test content');
      expect(context[0]?.timestamp).toBeInstanceOf(Date);
    });

    it('should handle legacy format (array instead of object)', async () => {
      const mockData = JSON.stringify([
        {
          id: '1',
          timestamp: '2024-01-01T00:00:00.000Z',
          type: 'conversation',
          content: 'Legacy content'
        }
      ]);

      mockFs.readFile.mockResolvedValue(mockData);

      await contextService.initialize();

      const context = await contextService.getRecentContext(10, 'admin');
      expect(context).toHaveLength(1);
      expect(context[0]?.content).toBe('Legacy content');
    });
  });

  describe('addEntry', () => {
    beforeEach(async () => {
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' } as any);
      mockFs.writeFile.mockResolvedValue(undefined);
      await contextService.initialize();
    });

    it('should add entry and save to file', async () => {
      await contextService.addEntry(
        'conversation',
        'Test message',
        { source: 'test' },
        'user1'
      );

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        testContextFile,
        expect.stringContaining('Test message'),
        'utf-8'
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
      mockFs.writeFile.mockRejectedValue(new Error('Write failed'));

      await expect(
        contextService.addEntry('conversation', 'Test message')
      ).rejects.toThrow('Write failed');
    });
  });

  describe('getRecentContext', () => {
    beforeEach(async () => {
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' } as any);
      mockFs.writeFile.mockResolvedValue(undefined);
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

    it('should limit number of entries returned', async () => {
      const context = await contextService.getRecentContext(2, 'user1');
      
      expect(context).toHaveLength(2);
      expect(context.map(e => e.content)).toEqual([
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
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' } as any);
      mockFs.writeFile.mockResolvedValue(undefined);
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
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' } as any);
      mockFs.writeFile.mockResolvedValue(undefined);
      await contextService.initialize();
    });

    it('should check if compression is needed', () => {
      const checkMethod = (contextService as any).shouldCompress;
      
      // Mock context with total length > threshold
      const longContext = Array(10).fill(null).map(() => 'x'.repeat(700)); // 7000 chars total
      expect(checkMethod(longContext)).toBe(true);
      
      const shortContext = ['short', 'content'];
      expect(checkMethod(shortContext)).toBe(false);
    });

    it('should extract compression candidates', () => {
      const extractMethod = (contextService as any).getCompressionCandidates;
      
      const mockEntries: ContextEntry[] = [
        {
          id: '1',
          timestamp: new Date('2024-01-01'),
          type: 'conversation',
          content: 'Old entry',
          metadata: {}
        },
        {
          id: '2', 
          timestamp: new Date('2024-01-05'),
          type: 'work_summary',
          content: 'Recent work',
          metadata: {}
        },
        {
          id: '3',
          timestamp: new Date('2024-01-03'),
          type: 'schedule',
          content: 'Middle entry',
          metadata: {}
        }
      ];

      const candidates = extractMethod(mockEntries, 2);
      expect(candidates).toHaveLength(2);
      expect(candidates[0].content).toBe('Old entry'); // Oldest first
      expect(candidates[1].content).toBe('Middle entry');
    });
  });
});