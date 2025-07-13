import os from 'os';
import process from 'process';
import fs from 'fs/promises';
import path from 'path';
import logger from '../../utils/logger';

export interface PerformanceMetrics {
  timestamp: Date;
  memory: {
    used: number;
    free: number;
    total: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
    arrayBuffers: number;
  };
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  system: {
    uptime: number;
    platform: string;
    arch: string;
    nodeVersion: string;
  };
  application: {
    uptime: number;
    pid: number;
    activeHandles: number;
    activeRequests: number;
  };
  cache?: {
    hitRate: number;
    size: number;
    memoryUsage: number;
  };
}

export interface PerformanceAlert {
  id: string;
  type: 'memory' | 'cpu' | 'disk' | 'response_time';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
  resolved: boolean;
}

// Interfaces for data loaded from JSON
type LoadedMetric = Omit<PerformanceMetrics, 'timestamp'> & { timestamp: string };
type LoadedAlert = Omit<PerformanceAlert, 'timestamp'> & { timestamp: string };

export class PerformanceMonitorService {
  private metrics: PerformanceMetrics[] = [];
  private alerts: PerformanceAlert[] = [];
  private monitoringInterval?: NodeJS.Timeout;
  private metricsFile: string;
  private alertsFile: string;
  private isRunning = false;

  // 性能阈值配置
  private thresholds = {
    memoryUsage: 0.85, // 85% 内存使用率
    cpuUsage: 0.8, // 80% CPU使用率
    heapUsage: 0.9, // 90% 堆内存使用率
    responseTime: 5000, // 5秒响应时间
  };

  private startTime = Date.now();

  constructor() {
    this.metricsFile = path.join(process.cwd(), 'data', 'performance-metrics.json');
    this.alertsFile = path.join(process.cwd(), 'data', 'performance-alerts.json');
  }

  async initialize(): Promise<void> {
    try {
      // 确保数据目录存在
      const dataDir = path.dirname(this.metricsFile);
      await fs.mkdir(dataDir, { recursive: true });

      // 加载历史数据
      await this.loadMetrics();
      await this.loadAlerts();

      logger.info('Performance monitoring service initialized');
    } catch (error) {
      logger.error('Failed to initialize performance monitoring service:', error);
      throw error;
    }
  }

  async start(intervalMs = 60000): Promise<void> {
    if (this.isRunning) {
      logger.warn('Performance monitoring is already running');
      return;
    }

    this.isRunning = true;

    // 立即收集一次指标
    await this.collectMetrics();

    // 设置定期收集
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.collectMetrics();
        await this.checkAlerts();
        await this.cleanup();
      } catch (error) {
        logger.error('Error during performance monitoring:', error);
      }
    }, intervalMs);

    logger.info(`Performance monitoring started with ${intervalMs}ms interval`);
  }

  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      delete this.monitoringInterval;
    }
    this.isRunning = false;
    logger.info('Performance monitoring stopped');
  }

  private async collectMetrics(): Promise<void> {
    try {
      const memoryUsage = process.memoryUsage();
      const cpuUsage = await this.getCpuUsage();

      // _getActiveHandles and _getActiveRequests are undocumented and not in @types/node
      // Using ts-expect-error to suppress errors while retaining functionality.
      // @ts-expect-error -- Undocumented API
      const activeHandles = process._getActiveHandles?.().length || 0;
      // @ts-expect-error -- Undocumented API
      const activeRequests = process._getActiveRequests?.().length || 0;

      const metrics: PerformanceMetrics = {
        timestamp: new Date(),
        memory: {
          used: os.totalmem() - os.freemem(),
          free: os.freemem(),
          total: os.totalmem(),
          heapUsed: memoryUsage.heapUsed,
          heapTotal: memoryUsage.heapTotal,
          external: memoryUsage.external,
          arrayBuffers: memoryUsage.arrayBuffers,
        },
        cpu: {
          usage: cpuUsage,
          loadAverage: os.loadavg(),
        },
        system: {
          uptime: os.uptime(),
          platform: os.platform(),
          arch: os.arch(),
          nodeVersion: process.version,
        },
        application: {
          uptime: (Date.now() - this.startTime) / 1000,
          pid: process.pid,
          activeHandles,
          activeRequests,
        },
      };

      // 尝试获取缓存统计（如果可用）
      try {
        const { globalCache } = await import('./cacheService');
        const cacheStats = globalCache.getStats();
        metrics.cache = {
          hitRate: cacheStats.hitRate,
          size: cacheStats.size,
          memoryUsage: cacheStats.memoryUsage,
        };
      } catch {
        // 缓存服务不可用，跳过
      }

      this.metrics.push(metrics);

      // 保持最近1000条记录
      if (this.metrics.length > 1000) {
        this.metrics = this.metrics.slice(-1000);
      }

      await this.saveMetrics();

      logger.debug('Performance metrics collected', {
        memoryUsed: Math.round(metrics.memory.used / 1024 / 1024),
        cpuUsage: Math.round(metrics.cpu.usage * 100),
        heapUsed: Math.round(metrics.memory.heapUsed / 1024 / 1024),
      });
    } catch (error) {
      logger.error('Failed to collect performance metrics:', error);
    }
  }

  private async getCpuUsage(): Promise<number> {
    return new Promise(resolve => {
      const startUsage = process.cpuUsage();
      const startTime = Date.now();

      setTimeout(() => {
        const endUsage = process.cpuUsage(startUsage);
        const endTime = Date.now();

        const userUsage = endUsage.user / 1000; // 转换为毫秒
        const systemUsage = endUsage.system / 1000;
        const totalUsage = userUsage + systemUsage;
        const elapsedTime = endTime - startTime;

        const cpuPercent = totalUsage / elapsedTime / os.cpus().length;
        resolve(Math.min(cpuPercent, 1)); // 限制在0-1之间
      }, 100);
    });
  }

  private async checkAlerts(): Promise<void> {
    if (this.metrics.length === 0) return;

    const latest = this.metrics[this.metrics.length - 1];
    if (!latest) return;
    const newAlerts: PerformanceAlert[] = [];

    // 检查内存使用率
    const memoryUsagePercent = latest.memory.used / latest.memory.total;
    if (memoryUsagePercent > this.thresholds.memoryUsage) {
      newAlerts.push({
        id: `memory_${Date.now()}`,
        type: 'memory',
        severity: memoryUsagePercent > 0.95 ? 'critical' : 'high',
        message: `High memory usage: ${Math.round(memoryUsagePercent * 100)}%`,
        value: memoryUsagePercent,
        threshold: this.thresholds.memoryUsage,
        timestamp: new Date(),
        resolved: false,
      });
    }

    // 检查CPU使用率
    if (latest.cpu.usage > this.thresholds.cpuUsage) {
      newAlerts.push({
        id: `cpu_${Date.now()}`,
        type: 'cpu',
        severity: latest.cpu.usage > 0.95 ? 'critical' : 'high',
        message: `High CPU usage: ${Math.round(latest.cpu.usage * 100)}%`,
        value: latest.cpu.usage,
        threshold: this.thresholds.cpuUsage,
        timestamp: new Date(),
        resolved: false,
      });
    }

    // 检查堆内存使用率
    const heapUsagePercent = latest.memory.heapUsed / latest.memory.heapTotal;
    if (heapUsagePercent > this.thresholds.heapUsage) {
      newAlerts.push({
        id: `heap_${Date.now()}`,
        type: 'memory',
        severity: heapUsagePercent > 0.98 ? 'critical' : 'medium',
        message: `High heap usage: ${Math.round(heapUsagePercent * 100)}%`,
        value: heapUsagePercent,
        threshold: this.thresholds.heapUsage,
        timestamp: new Date(),
        resolved: false,
      });
    }

    // 添加新警报
    if (newAlerts.length > 0) {
      this.alerts.push(...newAlerts);
      await this.saveAlerts();

      // 记录警报
      for (const alert of newAlerts) {
        logger.warn(`Performance Alert [${alert.severity}]: ${alert.message}`, {
          type: alert.type,
          value: alert.value,
          threshold: alert.threshold,
        });
      }
    }
  }

  private async cleanup(): Promise<void> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // 清理旧指标（保留24小时内的）
    const originalMetricsCount = this.metrics.length;
    this.metrics = this.metrics.filter(m => m.timestamp > oneDayAgo);

    // 清理已解决的旧警报（保留1小时内的未解决警报）
    const originalAlertsCount = this.alerts.length;
    this.alerts = this.alerts.filter(
      a => (!a.resolved && a.timestamp > oneHourAgo) || (a.resolved && a.timestamp > oneDayAgo)
    );

    if (
      this.metrics.length !== originalMetricsCount ||
      this.alerts.length !== originalAlertsCount
    ) {
      await this.saveMetrics();
      await this.saveAlerts();

      logger.debug('Performance data cleanup completed', {
        metricsRemoved: originalMetricsCount - this.metrics.length,
        alertsRemoved: originalAlertsCount - this.alerts.length,
      });
    }
  }

  // 公共API方法
  getCurrentMetrics(): PerformanceMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] || null : null;
  }

  getMetricsHistory(minutes = 60): PerformanceMetrics[] {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    return this.metrics.filter(m => m.timestamp > cutoff);
  }

  getActiveAlerts(): PerformanceAlert[] {
    return this.alerts.filter(a => !a.resolved);
  }

  getAllAlerts(hours = 24): PerformanceAlert[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.alerts.filter(a => a.timestamp > cutoff);
  }

  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      this.saveAlerts().catch(err => logger.error('Failed to save alerts after resolving:', err));
      return true;
    }
    return false;
  }

  getHealthScore(): number {
    const current = this.getCurrentMetrics();
    if (!current) return 100;

    let score = 100;

    // 内存使用率扣分
    const memoryUsage = current.memory.used / current.memory.total;
    if (memoryUsage > 0.8) score -= (memoryUsage - 0.8) * 100;

    // CPU使用率扣分
    if (current.cpu.usage > 0.7) score -= (current.cpu.usage - 0.7) * 100;

    // 堆内存使用率扣分
    const heapUsage = current.memory.heapUsed / current.memory.heapTotal;
    if (heapUsage > 0.8) score -= (heapUsage - 0.8) * 50;

    // 活跃警报扣分
    const activeAlerts = this.getActiveAlerts();
    score -= activeAlerts.length * 5;

    return Math.max(0, Math.round(score));
  }

  private async loadMetrics(): Promise<void> {
    try {
      const data = await fs.readFile(this.metricsFile, 'utf-8');
      const parsed: LoadedMetric[] = JSON.parse(data);
      this.metrics = parsed.map(m => ({
        ...m,
        timestamp: new Date(m.timestamp),
      }));
    } catch (error: unknown) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
        logger.error('Failed to load performance metrics:', error);
      }
      this.metrics = [];
    }
  }

  private async saveMetrics(): Promise<void> {
    try {
      await fs.writeFile(this.metricsFile, JSON.stringify(this.metrics, null, 2));
    } catch (error) {
      logger.error('Failed to save performance metrics:', error);
    }
  }

  private async loadAlerts(): Promise<void> {
    try {
      const data = await fs.readFile(this.alertsFile, 'utf-8');
      const parsed: LoadedAlert[] = JSON.parse(data);
      this.alerts = parsed.map(a => ({
        ...a,
        timestamp: new Date(a.timestamp),
      }));
    } catch (error: unknown) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
        logger.error('Failed to load performance alerts:', error);
      }
      this.alerts = [];
    }
  }

  private async saveAlerts(): Promise<void> {
    try {
      await fs.writeFile(this.alertsFile, JSON.stringify(this.alerts, null, 2));
    } catch (error) {
      logger.error('Failed to save performance alerts:', error);
    }
  }

  // 更新阈值配置
  updateThresholds(newThresholds: Partial<typeof this.thresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    logger.info('Performance thresholds updated', this.thresholds);
  }

  getThresholds(): typeof this.thresholds {
    return { ...this.thresholds };
  }
}

export default PerformanceMonitorService;
