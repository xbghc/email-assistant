import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import logger from './utils/logger';
import { validateConfig } from './config/index';
import SchedulerService from './services/core/schedulerService';
import SystemStartupService from './services/core/systemStartupService';
import SystemHealthService from './services/core/systemHealthService';
import PerformanceMonitorService from './services/system/performanceMonitorService';
import EmailReceiveService from './services/email/emailReceiveService';
import EmailReplyHandler from './services/email/emailReplyHandler';
import ReminderTrackingService from './services/user/reminderTrackingService';
import scheduleRoutes from './routes/schedule';
import webRoutes from './routes/web';
import authRoutes from './routes/auth';
import { serviceManager } from './services/core/serviceManager';

const app = express();
const port = process.env.PORT || 3000;

// 安全头部中间件
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// 安全的CORS配置
const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // 开发环境允许所有来源
    if (process.env.NODE_ENV === 'development' || !origin) {
      callback(null, true);
      return;
    }
    
    // 生产环境只允许配置的域名
    const allowedOrigins = process.env.CORS_ORIGINS ? 
      process.env.CORS_ORIGINS.split(',') : 
      ['https://localhost:3000'];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// 请求体解析中间件（带安全限制）
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 支持路径前缀部署
const pathPrefix = process.env.PATH_PREFIX || '';
if (pathPrefix) {
  logger.info(`📍 Application will be served with path prefix: ${pathPrefix}`);
}

let schedulerService: SchedulerService;
let startupService: SystemStartupService;
let healthService: SystemHealthService;
let performanceMonitor: PerformanceMonitorService;
let emailReceiveService: EmailReceiveService;
let emailReplyHandler: EmailReplyHandler;
let reminderTrackingService: ReminderTrackingService;

// 导出服务实例供其他模块使用
export function getSchedulerService(): SchedulerService {
  if (!schedulerService) {
    throw new Error('SchedulerService not initialized');
  }
  return schedulerService;
}

export function getHealthService(): SystemHealthService {
  if (!healthService) {
    throw new Error('SystemHealthService not initialized');
  }
  return healthService;
}

export function getPerformanceMonitor(): PerformanceMonitorService {
  if (!performanceMonitor) {
    throw new Error('PerformanceMonitorService not initialized');
  }
  return performanceMonitor;
}

async function startServer(): Promise<void> {
  try {
    // 初始化服务
    // 验证配置
    validateConfig();
    logger.info('✅ Configuration validated successfully');

    // 创建服务实例
    schedulerService = new SchedulerService();
    startupService = new SystemStartupService();
    healthService = new SystemHealthService();
    performanceMonitor = new PerformanceMonitorService();
    emailReceiveService = new EmailReceiveService();
    emailReplyHandler = new EmailReplyHandler();
    reminderTrackingService = new ReminderTrackingService();
    
    // 注册服务到服务管理器
    serviceManager.registerService({
      name: 'scheduler',
      instance: schedulerService,
      priority: 100
    });
    
    serviceManager.registerService({
      name: 'health',
      instance: healthService,
      priority: 90
    });
    
    serviceManager.registerService({
      name: 'performance',
      instance: performanceMonitor,
      priority: 80
    });
    
    serviceManager.registerService({
      name: 'reminderTracking',
      instance: reminderTrackingService,
      priority: 70
    });
    
    serviceManager.registerService({
      name: 'emailReplyHandler',
      instance: emailReplyHandler,
      dependencies: ['reminderTracking'],
      priority: 60
    });
    
    serviceManager.registerService({
      name: 'emailReceive',
      instance: emailReceiveService,
      dependencies: ['emailReplyHandler'],
      priority: 50
    });
    
    serviceManager.registerService({
      name: 'startup',
      instance: startupService,
      dependencies: ['scheduler', 'health', 'emailReceive'],
      priority: 10
    });
    
    // 使用服务管理器初始化所有服务
    await serviceManager.initializeAll();
    
    // 设置服务间的引用（仅限无法通过事件解耦的部分）
    emailReplyHandler.setSchedulerService(schedulerService);
    
    // 启动所有服务
    await serviceManager.startAll();
    
    // 在开发模式下启用事件调试
    if (process.env.NODE_ENV === 'development') {
      const { enableEventDebugging } = await import('./utils/eventDebugger');
      enableEventDebugging();
    }
    
    // 启动性能监控
    await performanceMonitor.start(60000); // 每分钟收集一次指标
    
    // 发送系统启动通知
    await startupService.sendStartupNotification();
    
    logger.info('✅ All services initialized with event-driven architecture and service management');

    // 事件调试路由
    app.get('/api/debug/events', async (_, res) => {
      try {
        const { eventDebugger } = await import('./utils/eventDebugger');
        const report = eventDebugger.generateReport();
        res.json({ report, history: eventDebugger.getEventHistory(50) });
      } catch (error) {
        logger.error('Failed to get event debug info:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    app.get('/health', async (_, res) => {
      try {
        const health = await healthService.getQuickHealth();
        res.json(health);
      } catch (error) {
        logger.error('Health check failed:', error);
        res.status(503).json({
          status: 'critical',
          timestamp: new Date(),
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          error: 'Health check failed'
        });
      }
    });

    app.use('/api/schedule', scheduleRoutes);
    app.use('/api/auth', authRoutes);
    
    // Web管理界面路由
    app.use('/', webRoutes);

    app.post('/work-report', async (req, res) => {
      try {
        const { report } = req.body;
        if (!report) {
          res.status(400).json({ error: 'Work report is required' });
          return;
        }

        await schedulerService.processWorkReport(report);
        res.json({ message: 'Work report processed successfully' });
      } catch (error) {
        logger.error('Failed to process work report:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    app.post('/test/morning-reminder', async (_, res) => {
      try {
        await schedulerService.testMorningReminder();
        res.json({ message: 'Morning reminder test sent successfully' });
      } catch (error) {
        logger.error('Failed to test morning reminder:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    app.post('/test/evening-reminder', async (_, res) => {
      try {
        await schedulerService.testEveningReminder();
        res.json({ message: 'Evening reminder test sent successfully' });
      } catch (error) {
        logger.error('Failed to test evening reminder:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    app.post('/test/user-notifications', async (_, res) => {
      try {
        await startupService.testUserNotifications();
        res.json({ message: 'User notification test sent successfully' });
      } catch (error) {
        logger.error('Failed to test user notifications:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    app.post('/test/startup-notification', async (_, res) => {
      try {
        await startupService.sendStartupNotification();
        res.json({ message: 'Startup notification test sent successfully' });
      } catch (error) {
        logger.error('Failed to test startup notification:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    app.post('/test/shutdown-notification', async (_, res) => {
      try {
        await startupService.sendShutdownNotification();
        res.json({ message: 'Shutdown notification test sent successfully' });
      } catch (error) {
        logger.error('Failed to test shutdown notification:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    app.post('/test/rename-command', async (req, res) => {
      try {
        const { email, newName } = req.body;
        if (!email || !newName) {
          res.status(400).json({ error: 'Email and newName are required' });
          return;
        }
        
        // 模拟管理员命令执行
        const AdminCommandService = (await import('./services/admin/adminCommandService')).default;
        const UserService = (await import('./services/user/userService')).default;
        const userService = new UserService();
        await userService.initialize();
        
        const adminService = new AdminCommandService(userService);
        const result = await adminService.processCommand('/rename', `${email} ${newName}`);
        
        res.json({ message: 'Rename command test completed', result });
      } catch (error) {
        logger.error('Failed to test rename command:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    app.post('/test/weekly-report', async (req, res) => {
      try {
        const { userId, weekOffset } = req.body;
        
        const WeeklyReportService = (await import('./services/reports/weeklyReportService')).default;
        const weeklyService = new WeeklyReportService();
        await weeklyService.initialize();
        
        if (userId === 'all') {
          await weeklyService.generateAllUsersWeeklyReports(weekOffset || 0);
          res.json({ message: 'Weekly reports generated for all users' });
        } else {
          const targetUserId = userId || 'admin';
          const report = await weeklyService.generateWeeklyReport(targetUserId, weekOffset || 0);
          res.json({ message: 'Weekly report generated', report });
        }
      } catch (error) {
        logger.error('Failed to test weekly report:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    app.post('/test/personalized-suggestions', async (req, res) => {
      try {
        const { userId } = req.body;
        
        const PersonalizationService = (await import('./services/reports/personalizationService')).default;
        const personalizationService = new PersonalizationService();
        await personalizationService.initialize();
        
        if (userId === 'all') {
          await personalizationService.generatePersonalizedSuggestionsForAllUsers();
          res.json({ message: 'Personalized suggestions generated for all users' });
        } else {
          const targetUserId = userId || 'admin';
          const result = await personalizationService.generatePersonalizedSuggestions(targetUserId);
          res.json({ message: 'Personalized suggestions generated', result });
        }
      } catch (error) {
        logger.error('Failed to test personalized suggestions:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // 绑定到所有网络接口以支持远程访问
    const host = process.env.HOST || '0.0.0.0';
    app.listen(Number(port), host, () => {
      logger.info(`✅ Email Assistant Server started on ${host}:${port}`);
      logger.info(`📱 Web管理界面: http://${host}:${port}`);
      if (host === '0.0.0.0') {
        logger.info(`🌐 远程访问: http://YOUR_SERVER_IP:${port}`);
      }
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  try {
    if (startupService) {
      await startupService.sendShutdownNotification();
    }
  } catch (error) {
    logger.error('Error sending shutdown notification:', error);
  }
  
  // 使用服务管理器进行优雅关闭
  await serviceManager.gracefulShutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  try {
    if (startupService) {
      await startupService.sendShutdownNotification();
    }
  } catch (error) {
    logger.error('Error sending shutdown notification:', error);
  }
  
  // 使用服务管理器进行优雅关闭
  await serviceManager.gracefulShutdown();
  process.exit(0);
});

startServer().catch((error: unknown) => {
  logger.error('Failed to start application:', error);
  process.exit(1);
});