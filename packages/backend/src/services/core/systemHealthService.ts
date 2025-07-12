import logger from '../../utils/logger';
import EmailService from '../email/emailService';
import LogReaderService from '../logging/logReaderService';
import EmailStatsService from '../email/emailStatsService';
import ConfigService from '../system/configService';

export interface ServiceHealth {
  name: string;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  message: string;
  lastChecked: Date;
  responseTime?: number;
  details?: Record<string, unknown>;
}

export interface SystemHealth {
  overall: 'healthy' | 'warning' | 'critical';
  services: ServiceHealth[];
  metrics: {
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    emailsToday: number;
    errorsLastHour: number;
    warningsLastHour: number;
  };
  lastChecked: Date;
  version: string;
}

class SystemHealthService {
  private emailService: EmailService;
  private logReader: LogReaderService;
  private emailStats: EmailStatsService;
  private configService: ConfigService;

  constructor() {
    this.emailService = new EmailService();
    this.logReader = new LogReaderService();
    this.emailStats = new EmailStatsService();
    this.configService = new ConfigService();
  }

  async initialize(): Promise<void> {
    try {
      await this.emailService.initialize();
      await this.logReader.initialize();
      await this.emailStats.initialize();
      await this.configService.initialize();
      logger.info('System health service initialized');
    } catch (error) {
      logger.error('Failed to initialize system health service:', error);
    }
  }

  /**
   * 获取完整的系统健康状态
   */
  async getSystemHealth(): Promise<SystemHealth> {
    try {
      const startTime = Date.now();
      
      // 并行检查所有服务
      const [
        emailHealth,
        configHealth,
        logHealth,
        emailStatsHealth,
        aiHealth,
        diskHealth,
        memoryHealth
      ] = await Promise.allSettled([
        this.checkEmailService(),
        this.checkConfigService(),
        this.checkLoggingService(),
        this.checkEmailStatsService(),
        this.checkAIService(),
        this.checkDiskHealth(),
        this.checkMemoryHealth()
      ]);

      const services: ServiceHealth[] = [
        this.getResultValue(emailHealth, 'Email Service'),
        this.getResultValue(configHealth, 'Configuration'),
        this.getResultValue(logHealth, 'Logging System'),
        this.getResultValue(emailStatsHealth, 'Email Statistics'),
        this.getResultValue(aiHealth, 'AI Service'),
        this.getResultValue(diskHealth, 'Disk Storage'),
        this.getResultValue(memoryHealth, 'Memory Usage')
      ];

      // 获取系统指标
      const metrics = await this.getSystemMetrics();

      // 计算总体健康状态
      const overall = this.calculateOverallHealth(services);

      const healthCheckTime = Date.now() - startTime;
      
      logger.debug(`System health check completed in ${healthCheckTime}ms`);

      return {
        overall,
        services,
        metrics,
        lastChecked: new Date(),
        version: process.env.npm_package_version || '1.0.0'
      };
    } catch (error) {
      logger.error('Failed to get system health:', error);
      
      return {
        overall: 'critical',
        services: [{
          name: 'Health Check System',
          status: 'critical',
          message: 'Failed to perform health check',
          lastChecked: new Date()
        }],
        metrics: {
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          emailsToday: 0,
          errorsLastHour: -1,
          warningsLastHour: -1
        },
        lastChecked: new Date(),
        version: '1.0.0'
      };
    }
  }

  /**
   * 检查邮件服务健康状态
   */
  private async checkEmailService(): Promise<ServiceHealth> {
    const startTime = Date.now();
    
    try {
      const isConnected = await this.emailService.verifyConnection();
      const responseTime = Date.now() - startTime;
      
      if (isConnected) {
        return {
          name: 'Email Service',
          status: 'healthy',
          message: 'SMTP/IMAP connection successful',
          lastChecked: new Date(),
          responseTime
        };
      } else {
        return {
          name: 'Email Service',
          status: 'critical',
          message: 'Cannot connect to email server',
          lastChecked: new Date(),
          responseTime
        };
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        name: 'Email Service',
        status: 'critical',
        message: `Email service error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        lastChecked: new Date(),
        responseTime
      };
    }
  }

  /**
   * 检查配置服务健康状态
   */
  private async checkConfigService(): Promise<ServiceHealth> {
    try {
      const config = this.configService.getConfig();
      
      if (!config) {
        return {
          name: 'Configuration',
          status: 'critical',
          message: 'Configuration not loaded',
          lastChecked: new Date()
        };
      }

      const validation = this.configService.validateConfig(config);
      
      if (validation.isValid) {
        return {
          name: 'Configuration',
          status: 'healthy',
          message: 'Configuration is valid',
          lastChecked: new Date()
        };
      } else {
        return {
          name: 'Configuration',
          status: 'warning',
          message: `Configuration issues: ${validation.errors.join(', ')}`,
          lastChecked: new Date(),
          details: { errors: validation.errors }
        };
      }
    } catch (error) {
      return {
        name: 'Configuration',
        status: 'critical',
        message: `Configuration error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        lastChecked: new Date()
      };
    }
  }

  /**
   * 检查日志系统健康状态
   */
  private async checkLoggingService(): Promise<ServiceHealth> {
    try {
      const logHealth = await this.logReader.getSystemHealthFromLogs();
      
      return {
        name: 'Logging System',
        status: logHealth.status,
        message: logHealth.issues.length > 0 ? logHealth.issues.join('; ') : 'Logging system operational',
        lastChecked: new Date(),
        details: {
          errors: logHealth.errors,
          warnings: logHealth.warnings,
          lastError: logHealth.lastError
        }
      };
    } catch (error) {
      return {
        name: 'Logging System',
        status: 'warning',
        message: `Cannot read logs: ${error instanceof Error ? error.message : 'Unknown error'}`,
        lastChecked: new Date()
      };
    }
  }

  /**
   * 检查邮件统计服务健康状态
   */
  private async checkEmailStatsService(): Promise<ServiceHealth> {
    try {
      const stats = this.emailStats.getEmailStats();
      
      // 检查今日邮件发送是否正常
      const failureRate = stats.today.total > 0 ? 
        (stats.today.failed / stats.today.total) * 100 : 0;
      
      if (failureRate > 50) {
        return {
          name: 'Email Statistics',
          status: 'critical',
          message: `High email failure rate: ${failureRate.toFixed(1)}%`,
          lastChecked: new Date(),
          details: stats.today
        };
      } else if (failureRate > 20) {
        return {
          name: 'Email Statistics',
          status: 'warning',
          message: `Elevated email failure rate: ${failureRate.toFixed(1)}%`,
          lastChecked: new Date(),
          details: stats.today
        };
      } else {
        return {
          name: 'Email Statistics',
          status: 'healthy',
          message: `Email delivery healthy (${failureRate.toFixed(1)}% failure rate)`,
          lastChecked: new Date(),
          details: stats.today
        };
      }
    } catch (error) {
      return {
        name: 'Email Statistics',
        status: 'warning',
        message: `Stats unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`,
        lastChecked: new Date()
      };
    }
  }

  /**
   * 检查AI服务健康状态
   */
  private async checkAIService(): Promise<ServiceHealth> {
    try {
      const config = this.configService.getConfig();
      
      if (!config) {
        return {
          name: 'AI Service',
          status: 'warning',
          message: 'Cannot check AI service - configuration not available',
          lastChecked: new Date()
        };
      }

      if (config.ai.provider === 'mock') {
        return {
          name: 'AI Service',
          status: 'warning',
          message: 'Using mock AI service - no real AI functionality',
          lastChecked: new Date(),
          details: { provider: 'mock' }
        };
      }

      if (!config.ai.apiKey) {
        return {
          name: 'AI Service',
          status: 'critical',
          message: 'AI API key not configured',
          lastChecked: new Date(),
          details: { provider: config.ai.provider }
        };
      }

      return {
        name: 'AI Service',
        status: 'healthy',
        message: `AI service configured (${config.ai.provider})`,
        lastChecked: new Date(),
        details: { 
          provider: config.ai.provider,
          model: config.ai.model
        }
      };
    } catch (error) {
      return {
        name: 'AI Service',
        status: 'warning',
        message: `Cannot check AI service: ${error instanceof Error ? error.message : 'Unknown error'}`,
        lastChecked: new Date()
      };
    }
  }

  /**
   * 检查磁盘健康状态
   */
  private async checkDiskHealth(): Promise<ServiceHealth> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      // 检查关键目录
      const directories = [
        process.cwd(),
        path.join(process.cwd(), 'logs'),
        path.join(process.cwd(), 'data')
      ];

      for (const dir of directories) {
        try {
          await fs.access(dir);
        } catch {
          return {
            name: 'Disk Storage',
            status: 'warning',
            message: `Directory not accessible: ${dir}`,
            lastChecked: new Date()
          };
        }
      }

      return {
        name: 'Disk Storage',
        status: 'healthy',
        message: 'All required directories accessible',
        lastChecked: new Date()
      };
    } catch (error) {
      return {
        name: 'Disk Storage',
        status: 'warning',
        message: `Disk check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        lastChecked: new Date()
      };
    }
  }

  /**
   * 检查内存健康状态
   */
  private async checkMemoryHealth(): Promise<ServiceHealth> {
    try {
      const memUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
      const heapUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

      if (heapUsagePercent > 90) {
        return {
          name: 'Memory Usage',
          status: 'critical',
          message: `High memory usage: ${heapUsedMB}/${heapTotalMB}MB (${heapUsagePercent.toFixed(1)}%)`,
          lastChecked: new Date(),
          details: memUsage as unknown as Record<string, unknown>
        };
      } else if (heapUsagePercent > 75) {
        return {
          name: 'Memory Usage',
          status: 'warning',
          message: `Elevated memory usage: ${heapUsedMB}/${heapTotalMB}MB (${heapUsagePercent.toFixed(1)}%)`,
          lastChecked: new Date(),
          details: memUsage as unknown as Record<string, unknown>
        };
      } else {
        return {
          name: 'Memory Usage',
          status: 'healthy',
          message: `Memory usage normal: ${heapUsedMB}/${heapTotalMB}MB (${heapUsagePercent.toFixed(1)}%)`,
          lastChecked: new Date(),
          details: memUsage as unknown as Record<string, unknown>
        };
      }
    } catch (error) {
      return {
        name: 'Memory Usage',
        status: 'warning',
        message: `Memory check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        lastChecked: new Date()
      };
    }
  }

  /**
   * 获取系统指标
   */
  private async getSystemMetrics(): Promise<SystemHealth['metrics']> {
    try {
      const emailStats = this.emailStats.getEmailStats();
      const logStats = await this.logReader.getLogStatistics(1); // 最近1小时
      
      return {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        emailsToday: emailStats.today.sent,
        errorsLastHour: logStats.byLevel.error || 0,
        warningsLastHour: logStats.byLevel.warn || 0
      };
    } catch (error) {
      logger.error('Failed to get system metrics:', error);
      return {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        emailsToday: 0,
        errorsLastHour: -1,
        warningsLastHour: -1
      };
    }
  }

  /**
   * 计算总体健康状态
   */
  private calculateOverallHealth(services: ServiceHealth[]): 'healthy' | 'warning' | 'critical' {
    const criticalCount = services.filter(s => s.status === 'critical').length;
    const warningCount = services.filter(s => s.status === 'warning').length;

    if (criticalCount > 0) {
      return 'critical';
    } else if (warningCount > 2) {
      return 'warning';
    } else if (warningCount > 0) {
      return 'warning';
    } else {
      return 'healthy';
    }
  }

  /**
   * 从Promise.allSettled结果中提取值
   */
  private getResultValue(result: PromiseSettledResult<ServiceHealth>, serviceName: string): ServiceHealth {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        name: serviceName,
        status: 'critical',
        message: `Health check failed: ${result.reason}`,
        lastChecked: new Date()
      };
    }
  }

  /**
   * 快速健康检查（用于/health端点）
   */
  async getQuickHealth(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    timestamp: Date;
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
  }> {
    try {
      // 快速检查关键服务
      const emailConnected = await Promise.race([
        this.emailService.verifyConnection(),
        new Promise<boolean>(resolve => setTimeout(() => resolve(false), 2000)) // 2秒超时
      ]);

      const memUsage = process.memoryUsage();
      const heapUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

      let status: 'healthy' | 'warning' | 'critical' = 'healthy';

      if (!emailConnected || heapUsagePercent > 90) {
        status = 'critical';
      } else if (heapUsagePercent > 75) {
        status = 'warning';
      }

      return {
        status,
        timestamp: new Date(),
        uptime: process.uptime(),
        memoryUsage: memUsage
      };
    } catch (error) {
      logger.error('Quick health check failed:', error);
      return {
        status: 'critical',
        timestamp: new Date(),
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage()
      };
    }
  }
}

export default SystemHealthService;