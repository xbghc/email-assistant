import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import logger from './utils/logger';
import { validateConfig } from './config';
import SchedulerService from './services/schedulerService';
import SystemStartupService from './services/systemStartupService';
import SystemHealthService from './services/systemHealthService';
import PerformanceMonitorService from './services/performanceMonitorService';
import scheduleRoutes from './routes/schedule';
import webRoutes from './routes/web';
import authRoutes from './routes/auth';

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

    schedulerService = new SchedulerService();
    startupService = new SystemStartupService();
    healthService = new SystemHealthService();
    performanceMonitor = new PerformanceMonitorService();
    
    await schedulerService.initialize();
    await healthService.initialize();
    await performanceMonitor.initialize();
    
    // 启动性能监控
    await performanceMonitor.start(60000); // 每分钟收集一次指标
    
    // 发送系统启动通知
    await startupService.sendStartupNotification();

    app.get('/health', async (req, res) => {
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

    app.post('/test/morning-reminder', async (req, res) => {
      try {
        await schedulerService.testMorningReminder();
        res.json({ message: 'Morning reminder test sent successfully' });
      } catch (error) {
        logger.error('Failed to test morning reminder:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    app.post('/test/evening-reminder', async (req, res) => {
      try {
        await schedulerService.testEveningReminder();
        res.json({ message: 'Evening reminder test sent successfully' });
      } catch (error) {
        logger.error('Failed to test evening reminder:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    app.post('/test/user-notifications', async (req, res) => {
      try {
        await startupService.testUserNotifications();
        res.json({ message: 'User notification test sent successfully' });
      } catch (error) {
        logger.error('Failed to test user notifications:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    app.post('/test/startup-notification', async (req, res) => {
      try {
        await startupService.sendStartupNotification();
        res.json({ message: 'Startup notification test sent successfully' });
      } catch (error) {
        logger.error('Failed to test startup notification:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    app.post('/test/shutdown-notification', async (req, res) => {
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
        const AdminCommandService = (await import('./services/adminCommandService')).default;
        const UserService = (await import('./services/userService')).default;
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
        
        const WeeklyReportService = (await import('./services/weeklyReportService')).default;
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
        
        const PersonalizationService = (await import('./services/personalizationService')).default;
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
  if (schedulerService) {
    schedulerService.destroy();
  }
  if (performanceMonitor) {
    performanceMonitor.stop();
  }
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
  if (schedulerService) {
    schedulerService.destroy();
  }
  if (performanceMonitor) {
    performanceMonitor.stop();
  }
  process.exit(0);
});

startServer().catch(error => {
  logger.error('Failed to start application:', error);
  process.exit(1);
});