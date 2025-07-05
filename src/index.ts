import express from 'express';
import logger from './utils/logger';
import { validateConfig } from './config';
import SchedulerService from './services/schedulerService';
import SystemStartupService from './services/systemStartupService';
import scheduleRoutes from './routes/schedule';
import webRoutes from './routes/web';

const app = express();
const port = process.env.PORT || 3000;

// CORS支持，允许远程访问
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let schedulerService: SchedulerService;
let startupService: SystemStartupService;

async function startServer(): Promise<void> {
  try {
    // 初始化服务
    // 验证配置
    validateConfig();
    logger.info('✅ Configuration validated successfully');

    schedulerService = new SchedulerService();
    startupService = new SystemStartupService();
    
    await schedulerService.initialize();
    
    // 发送系统启动通知
    await startupService.sendStartupNotification();

    app.get('/health', (req, res) => {
      const emailStatus = schedulerService.getEmailReceiveStatus();
      res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        emailReceiver: emailStatus
      });
    });

    app.use('/api/schedule', scheduleRoutes);
    
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
  process.exit(0);
});

startServer().catch(error => {
  logger.error('Failed to start application:', error);
  process.exit(1);
});