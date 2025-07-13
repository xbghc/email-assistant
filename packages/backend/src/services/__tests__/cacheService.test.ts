import { CacheService, FunctionCache } from '../system/cacheService';

describe('CacheService', () => {
  let cacheService: CacheService;

  beforeEach(() => {
    jest.useFakeTimers();
    cacheService = new CacheService({ maxSize: 3, defaultTtl: 1000, cleanupInterval: 100 });
  });

  afterEach(() => {
    cacheService.destroy();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('basic operations', () => {
    it('should set and get values', () => {
      cacheService.set('key1', 'value1');
      expect(cacheService.get('key1')).toBe('value1');
    });

    it('should return undefined for non-existent keys', () => {
      expect(cacheService.get('nonexistent')).toBeUndefined();
    });

    it('should check if key exists', () => {
      cacheService.set('key1', 'value1');
      expect(cacheService.has('key1')).toBe(true);
      expect(cacheService.has('nonexistent')).toBe(false);
    });

    it('should delete values', () => {
      cacheService.set('key1', 'value1');
      expect(cacheService.delete('key1')).toBe(true);
      expect(cacheService.get('key1')).toBeUndefined();
      expect(cacheService.delete('nonexistent')).toBe(false);
    });

    it('should clear all values', () => {
      cacheService.set('key1', 'value1');
      cacheService.set('key2', 'value2');
      cacheService.clear();
      
      expect(cacheService.get('key1')).toBeUndefined();
      expect(cacheService.get('key2')).toBeUndefined();
    });
  });

  describe('TTL (Time To Live)', () => {
    it('should expire values after TTL', () => {
      cacheService.set('key1', 'value1', 500);
      expect(cacheService.get('key1')).toBe('value1');

      // Fast forward time beyond TTL
      jest.advanceTimersByTime(600);
      expect(cacheService.get('key1')).toBeUndefined();
    });

    it('should use default TTL when not specified', () => {
      cacheService.set('key1', 'value1'); // Uses default 1000ms TTL
      expect(cacheService.get('key1')).toBe('value1');

      jest.advanceTimersByTime(500);
      expect(cacheService.get('key1')).toBe('value1');

      jest.advanceTimersByTime(600);
      expect(cacheService.get('key1')).toBeUndefined();
    });

    it('should remove expired values from has check', () => {
      cacheService.set('key1', 'value1', 500);
      expect(cacheService.has('key1')).toBe(true);

      jest.advanceTimersByTime(600);
      expect(cacheService.has('key1')).toBe(false);
    });
  });

  describe('LRU eviction', () => {
    it('should evict least recently used item when cache is full', () => {
      // Fill cache to max size
      cacheService.set('key1', 'value1');
      jest.advanceTimersByTime(10); // Make sure timestamps are different
      cacheService.set('key2', 'value2');
      jest.advanceTimersByTime(10);
      cacheService.set('key3', 'value3');

      // Access key1 to make it more recently used
      jest.advanceTimersByTime(10);
      cacheService.get('key1');

      // Add new item - should evict key2 (oldest among non-accessed)
      jest.advanceTimersByTime(10);
      cacheService.set('key4', 'value4');

      expect(cacheService.get('key1')).toBe('value1'); // Still exists (accessed)
      expect(cacheService.get('key2')).toBeUndefined(); // Evicted (oldest)
      expect(cacheService.get('key3')).toBe('value3'); // Still exists
      expect(cacheService.get('key4')).toBe('value4'); // New item
    });

    it('should not evict when updating existing key', () => {
      cacheService.set('key1', 'value1');
      cacheService.set('key2', 'value2');
      cacheService.set('key3', 'value3');

      // Update existing key - should not trigger eviction
      cacheService.set('key1', 'updated_value1');

      expect(cacheService.get('key1')).toBe('updated_value1');
      expect(cacheService.get('key2')).toBe('value2');
      expect(cacheService.get('key3')).toBe('value3');
    });
  });

  describe('getOrSet', () => {
    it('should return cached value if exists', async () => {
      cacheService.set('key1', 'cached_value');
      const getter = jest.fn().mockResolvedValue('new_value');

      const result = await cacheService.getOrSet('key1', getter);

      expect(result).toBe('cached_value');
      expect(getter).not.toHaveBeenCalled();
    });

    it('should execute getter and cache result if not exists', async () => {
      const getter = jest.fn().mockResolvedValue('new_value');

      const result = await cacheService.getOrSet('key1', getter, 2000);

      expect(result).toBe('new_value');
      expect(getter).toHaveBeenCalledTimes(1);
      expect(cacheService.get('key1')).toBe('new_value');
    });

    it('should handle getter errors', async () => {
      const getter = jest.fn().mockRejectedValue(new Error('Getter failed'));

      await expect(cacheService.getOrSet('key1', getter)).rejects.toThrow('Getter failed');
      expect(cacheService.get('key1')).toBeUndefined();
    });
  });

  describe('statistics', () => {
    it('should track hits and misses', () => {
      cacheService.set('key1', 'value1');

      // Hit
      cacheService.get('key1');
      // Miss
      cacheService.get('nonexistent');

      const stats = cacheService.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(0.5);
    });

    it('should track cache size', () => {
      expect(cacheService.getStats().size).toBe(0);

      cacheService.set('key1', 'value1');
      cacheService.set('key2', 'value2');

      expect(cacheService.getStats().size).toBe(2);
    });

    it('should reset stats on clear', () => {
      cacheService.set('key1', 'value1');
      cacheService.get('key1');
      cacheService.get('nonexistent');

      cacheService.clear();

      const stats = cacheService.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.size).toBe(0);
    });

    it('should estimate memory usage', () => {
      const stats1 = cacheService.getStats();
      expect(stats1.memoryUsage).toBe(0);

      cacheService.set('key1', 'value1');
      const stats2 = cacheService.getStats();
      expect(stats2.memoryUsage).toBeGreaterThan(0);
    });
  });

  describe('cleanup', () => {
    it('should remove expired entries on access', () => {
      // Set items with short TTL
      cacheService.set('key1', 'value1', 50);
      cacheService.set('key2', 'value2', 150);

      expect(cacheService.getStats().size).toBe(2);

      // Advance time to expire first item
      jest.advanceTimersByTime(100);

      // Access expired key - should be removed automatically
      expect(cacheService.get('key1')).toBeUndefined();
      expect(cacheService.getStats().size).toBe(1);
      
      // Non-expired key should still exist
      expect(cacheService.get('key2')).toBe('value2');
    });

    it('should not run cleanup in test environment', () => {
      // Create cache service in test environment (which we're already in)
      const testCache = new CacheService({ cleanupInterval: 50 });
      
      testCache.set('key1', 'value1', 25);
      
      // Advance past cleanup interval
      jest.advanceTimersByTime(100);
      
      // Item should not be cleaned up automatically since we're in test env
      expect(testCache.getStats().size).toBe(1);
      
      testCache.destroy();
    });
  });

  describe('destroy', () => {
    it('should clean up resources', () => {
      cacheService.set('key1', 'value1');
      expect(cacheService.getStats().size).toBe(1);

      cacheService.destroy();

      expect(cacheService.getStats().size).toBe(0);
    });
  });
});

describe('FunctionCache', () => {
  let functionCache: FunctionCache;

  beforeEach(() => {
    jest.useFakeTimers();
    functionCache = new FunctionCache(2, 1000);
  });

  afterEach(() => {
    functionCache.destroy();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('memoize', () => {
    it('should memoize function results', async () => {
      const mockFn = jest.fn().mockResolvedValue('result');
      const memoizedFn = await functionCache.memoize(mockFn);

      const result1 = await memoizedFn('arg1', 'arg2');
      const result2 = await memoizedFn('arg1', 'arg2');

      expect(result1).toBe('result');
      expect(result2).toBe('result');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should use custom key generator', async () => {
      const mockFn = jest.fn().mockResolvedValue('result');
      const keyGenerator = jest.fn().mockReturnValue('custom-key');
      const memoizedFn = await functionCache.memoize(mockFn, keyGenerator);

      await memoizedFn('arg1', 'arg2');
      await memoizedFn('arg3', 'arg4'); // Different args but same key

      expect(keyGenerator).toHaveBeenCalledTimes(2);
      expect(keyGenerator).toHaveBeenCalledWith('arg1', 'arg2');
      expect(keyGenerator).toHaveBeenCalledWith('arg3', 'arg4');
      expect(mockFn).toHaveBeenCalledTimes(1); // Only called once due to caching
    });

    it('should handle different argument combinations', async () => {
      const mockFn = jest.fn()
        .mockResolvedValueOnce('result1')
        .mockResolvedValueOnce('result2');
      
      const memoizedFn = await functionCache.memoize(mockFn);

      const result1 = await memoizedFn('arg1');
      const result2 = await memoizedFn('arg2');
      const result3 = await memoizedFn('arg1'); // Should be cached

      expect(result1).toBe('result1');
      expect(result2).toBe('result2');
      expect(result3).toBe('result1');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('cache management', () => {
    it('should get cache stats', () => {
      const stats = functionCache.getStats();
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('memoryUsage');
    });

    it('should clear cache', async () => {
      const mockFn = jest.fn().mockResolvedValue('result');
      const memoizedFn = await functionCache.memoize(mockFn);

      await memoizedFn('arg1');
      expect(functionCache.getStats().size).toBe(1);

      functionCache.clear();
      expect(functionCache.getStats().size).toBe(0);

      // Should call function again after clear
      await memoizedFn('arg1');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should destroy cache', () => {
      functionCache.destroy();
      expect(functionCache.getStats().size).toBe(0);
    });
  });
});