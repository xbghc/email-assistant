import logger from '../utils/logger';
import { PerformanceMonitorService } from './performanceMonitorService';
import EmailService from './emailService';
import { CacheService } from './cacheService';
import UserService from './userService';

export interface BenchmarkResult {
  name: string;
  duration: number;
  memoryUsed: number;
  iterations: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  timestamp: Date;
}

export interface BenchmarkSuite {
  name: string;
  results: BenchmarkResult[];
  totalDuration: number;
  startTime: Date;
  endTime: Date;
}

/**
 * 性能基准测试服务
 */
export class BenchmarkService {
  private performanceMonitor: PerformanceMonitorService;
  private emailService: EmailService;
  private cacheService: CacheService;
  private userService: UserService;

  constructor() {
    this.performanceMonitor = new PerformanceMonitorService();
    this.emailService = new EmailService();
    this.cacheService = new CacheService();
    this.userService = new UserService();
  }

  /**
   * 运行基准测试
   */
  async runBenchmark(name: string, fn: () => Promise<void>, iterations = 100): Promise<BenchmarkResult> {
    const times: number[] = [];
    const initialMemory = process.memoryUsage().heapUsed;
    
    logger.info(`Running benchmark: ${name} (${iterations} iterations)`);
    
    // 预热
    await fn();
    
    // 实际测试
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await fn();
      const end = performance.now();
      times.push(end - start);
    }
    
    const finalMemory = process.memoryUsage().heapUsed;
    const totalDuration = times.reduce((sum, time) => sum + time, 0);
    
    const result: BenchmarkResult = {
      name,
      duration: totalDuration,
      memoryUsed: finalMemory - initialMemory,
      iterations,
      averageTime: totalDuration / iterations,
      minTime: Math.min(...times),
      maxTime: Math.max(...times),
      timestamp: new Date()
    };
    
    logger.info(`Benchmark ${name} completed:`, {
      averageTime: result.averageTime.toFixed(2) + 'ms',
      minTime: result.minTime.toFixed(2) + 'ms',
      maxTime: result.maxTime.toFixed(2) + 'ms',
      memoryUsed: (result.memoryUsed / 1024 / 1024).toFixed(2) + 'MB'
    });
    
    return result;
  }

  /**
   * 运行完整的基准测试套件
   */
  async runBenchmarkSuite(): Promise<BenchmarkSuite> {
    const startTime = new Date();
    const results: BenchmarkResult[] = [];
    
    logger.info('Starting performance benchmark suite');
    
    try {
      // 缓存性能测试
      results.push(await this.runBenchmark('Cache Set/Get', async () => {
        const key = `test-${Math.random()}`;
        const value = { data: 'test data', timestamp: Date.now() };
        this.cacheService.set(key, value);
        this.cacheService.get(key);
      }, 1000));
      
      // 用户服务性能测试
      results.push(await this.runBenchmark('User Service Operations', async () => {
        const users = this.userService.getAllUsers();
        const activeUsers = users.filter(u => u.isActive);
        activeUsers.forEach(user => {
          this.userService.getUserById(user.id);
        });
      }, 500));
      
      // JSON序列化性能测试
      results.push(await this.runBenchmark('JSON Serialization', async () => {
        const data = {
          users: Array.from({ length: 100 }, (_, i) => ({
            id: `user-${i}`,
            name: `User ${i}`,
            config: {
              settings: { theme: 'dark', language: 'en' }
            }
          }))
        };
        const serialized = JSON.stringify(data);
        JSON.parse(serialized);
      }, 200));
      
      // 文件操作性能测试
      results.push(await this.runBenchmark('File I/O Operations', async () => {
        const { promises: fs } = await import('fs');
        const path = await import('path');
        const testFile = path.join(process.cwd(), 'temp-test.json');
        const data = { test: true, timestamp: Date.now() };
        
        await fs.writeFile(testFile, JSON.stringify(data));
        await fs.readFile(testFile, 'utf8');
        await fs.unlink(testFile).catch(() => {/* ignore */});
      }, 50));
      
      // 性能监控开销测试
      results.push(await this.runBenchmark('Performance Monitoring Overhead', async () => {
        // 简单的性能监控调用
        process.memoryUsage();
        process.cpuUsage();
      }, 500));
      
    } catch (error) {
      logger.error('Benchmark suite failed:', error);
      throw error;
    }
    
    const endTime = new Date();
    const totalDuration = endTime.getTime() - startTime.getTime();
    
    const suite: BenchmarkSuite = {
      name: 'Email Assistant Performance Suite',
      results,
      totalDuration,
      startTime,
      endTime
    };
    
    logger.info('Benchmark suite completed', {
      totalTests: results.length,
      totalDuration: totalDuration + 'ms',
      averagePerformance: this.calculateAveragePerformance(results)
    });
    
    return suite;
  }
  
  /**
   * 计算平均性能指标
   */
  private calculateAveragePerformance(results: BenchmarkResult[]): Record<string, string> {
    const totalTests = results.length;
    const avgTime = results.reduce((sum, r) => sum + r.averageTime, 0) / totalTests;
    const totalMemory = results.reduce((sum, r) => sum + r.memoryUsed, 0);
    
    return {
      averageExecutionTime: avgTime.toFixed(2) + 'ms',
      totalMemoryUsed: (totalMemory / 1024 / 1024).toFixed(2) + 'MB',
      testsPerSecond: (1000 / avgTime).toFixed(2)
    };
  }
  
  /**
   * 生成基准测试报告
   */
  generateReport(suite: BenchmarkSuite): string {
    const lines = [
      `# Performance Benchmark Report`,
      ``,
      `**Suite:** ${suite.name}`,
      `**Start Time:** ${suite.startTime.toISOString()}`,
      `**End Time:** ${suite.endTime.toISOString()}`,
      `**Total Duration:** ${suite.totalDuration}ms`,
      ``,
      `## Results`,
      ``
    ];
    
    suite.results.forEach(result => {
      lines.push(`### ${result.name}`);
      lines.push(`- **Iterations:** ${result.iterations}`);
      lines.push(`- **Average Time:** ${result.averageTime.toFixed(2)}ms`);
      lines.push(`- **Min Time:** ${result.minTime.toFixed(2)}ms`);
      lines.push(`- **Max Time:** ${result.maxTime.toFixed(2)}ms`);
      lines.push(`- **Memory Used:** ${(result.memoryUsed / 1024 / 1024).toFixed(2)}MB`);
      lines.push(`- **Ops/sec:** ${(1000 / result.averageTime).toFixed(2)}`);
      lines.push(``);
    });
    
    const avgPerf = this.calculateAveragePerformance(suite.results);
    lines.push(`## Summary`);
    lines.push(`- **Average Execution Time:** ${avgPerf.averageExecutionTime}`);
    lines.push(`- **Total Memory Used:** ${avgPerf.totalMemoryUsed}`);
    lines.push(`- **Tests Per Second:** ${avgPerf.testsPerSecond}`);
    
    return lines.join('\n');
  }
  
  /**
   * 保存基准测试结果
   */
  async saveBenchmarkResults(suite: BenchmarkSuite): Promise<void> {
    const { promises: fs } = await import('fs');
    const path = await import('path');
    
    const benchmarkDir = path.join(process.cwd(), 'benchmarks');
    await fs.mkdir(benchmarkDir, { recursive: true });
    
    const timestamp = suite.startTime.toISOString().replace(/[:.]/g, '-');
    const resultFile = path.join(benchmarkDir, `benchmark-${timestamp}.json`);
    const reportFile = path.join(benchmarkDir, `benchmark-${timestamp}.md`);
    
    // 保存JSON结果
    await fs.writeFile(resultFile, JSON.stringify(suite, null, 2));
    
    // 保存Markdown报告
    const report = this.generateReport(suite);
    await fs.writeFile(reportFile, report);
    
    logger.info('Benchmark results saved:', {
      resultFile,
      reportFile
    });
  }
}

export default BenchmarkService;