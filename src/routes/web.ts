import express from 'express';
import path from 'path';
import logger from '../utils/logger';
import UserService from '../services/userService';
import WeeklyReportService from '../services/weeklyReportService';
import PersonalizationService from '../services/personalizationService';

const router = express.Router();

// 静态文件服务
router.use('/css', express.static(path.join(__dirname, '../public/css')));
router.use('/js', express.static(path.join(__dirname, '../public/js')));

// 主页面路由
router.get('/', (req, res) => {
  try {
    res.sendFile(path.join(__dirname, '../public/views/index.html'));
  } catch (error) {
    logger.error('Failed to serve main page:', error);
    res.status(500).send('Internal Server Error');
  }
});

// API路由 - 用户管理
router.get('/api/users', async (req, res) => {
  try {
    const userService = new UserService();
    await userService.initialize();
    
    const users = userService.getAllUsers();
    res.json({
      success: true,
      data: users.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        config: user.config
      }))
    });
  } catch (error) {
    logger.error('Failed to get users:', error);
    res.status(500).json({ success: false, error: 'Failed to get users' });
  }
});

router.post('/api/users', async (req, res) => {
  try {
    const { name, email, timezone } = req.body;
    
    if (!name || !email) {
      res.status(400).json({ 
        success: false, 
        error: 'Name and email are required' 
      });
      return;
    }
    
    const userService = new UserService();
    await userService.initialize();
    
    const newUser = {
      id: `user_${Date.now()}`,
      name,
      email,
      config: {
        schedule: {
          morningReminderTime: '09:00',
          eveningReminderTime: '18:00',
          timezone: timezone || 'Asia/Shanghai'
        },
        language: 'zh' as 'zh' | 'en'
      },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    userService.addUser(newUser);
    
    logger.info(`New user added: ${name} (${email})`);
    res.json({ success: true, data: newUser });
  } catch (error) {
    logger.error('Failed to add user:', error);
    res.status(500).json({ success: false, error: 'Failed to add user' });
  }
});

router.put('/api/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const updateData = req.body;
    
    const userService = new UserService();
    await userService.initialize();
    
    const user = userService.getUserById(userId);
    if (!user) {
      res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
      return;
    }
    
    const updatedUser = {
      ...user,
      ...updateData,
      updatedAt: new Date()
    };
    
    userService.updateUser(userId, updatedUser);
    
    logger.info(`User updated: ${userId}`);
    res.json({ success: true, data: updatedUser });
  } catch (error) {
    logger.error('Failed to update user:', error);
    res.status(500).json({ success: false, error: 'Failed to update user' });
  }
});

router.delete('/api/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const userService = new UserService();
    await userService.initialize();
    
    const user = userService.getUserById(userId);
    if (!user) {
      res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
      return;
    }
    
    userService.removeUser(userId);
    
    logger.info(`User deleted: ${userId}`);
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    logger.error('Failed to delete user:', error);
    res.status(500).json({ success: false, error: 'Failed to delete user' });
  }
});

// API路由 - 系统状态
router.get('/api/system/status', async (req, res) => {
  try {
    const systemStatus = {
      services: [
        {
          name: 'API服务',
          status: 'running',
          description: 'Express服务器运行正常',
          uptime: process.uptime()
        },
        {
          name: '邮件服务',
          status: 'running',
          description: 'SMTP/IMAP连接正常'
        },
        {
          name: '调度器',
          status: 'running',
          description: '定时任务正常执行'
        },
        {
          name: 'AI服务',
          status: 'running',
          description: 'AI接口响应正常'
        }
      ],
      metrics: {
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
        uptime: process.uptime(),
        version: process.version
      },
      timestamp: new Date()
    };
    
    res.json({ success: true, data: systemStatus });
  } catch (error) {
    logger.error('Failed to get system status:', error);
    res.status(500).json({ success: false, error: 'Failed to get system status' });
  }
});

// API路由 - 报告管理
router.get('/api/reports', async (req, res) => {
  try {
    const { type, userId, limit = 20 } = req.query;
    
    // 这里应该从数据库或文件系统获取报告列表
    // 目前返回模拟数据
    const reports = [
      {
        id: 1,
        type: 'weekly',
        title: '工作周报 - 2025年第1周',
        userId: 'admin',
        generatedAt: new Date('2025-01-06T09:00:00Z'),
        summary: '本周完成了邮件助手的核心功能开发，包括周报生成和个性化建议功能。'
      },
      {
        id: 2,
        type: 'suggestions',
        title: '个性化建议报告',
        userId: 'admin',
        generatedAt: new Date('2025-01-05T15:00:00Z'),
        summary: '基于用户工作模式分析生成的个性化建议，包含生产力提升和时间管理建议。'
      }
    ];
    
    let filteredReports = reports;
    
    if (type) {
      filteredReports = filteredReports.filter(report => report.type === type);
    }
    
    if (userId) {
      filteredReports = filteredReports.filter(report => report.userId === userId);
    }
    
    // 按生成时间倒序排列并限制数量
    filteredReports = filteredReports
      .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime())
      .slice(0, parseInt(limit as string));
    
    res.json({ success: true, data: filteredReports });
  } catch (error) {
    logger.error('Failed to get reports:', error);
    res.status(500).json({ success: false, error: 'Failed to get reports' });
  }
});

router.get('/api/reports/:reportId', async (req, res) => {
  try {
    const { reportId } = req.params;
    
    // 这里应该从数据库或文件系统获取具体报告内容
    // 目前返回模拟数据
    const report = {
      id: parseInt(reportId),
      type: 'weekly',
      title: '工作周报 - 2025年第1周',
      userId: 'admin',
      generatedAt: new Date('2025-01-06T09:00:00Z'),
      content: {
        summary: '本周工作总结',
        achievements: ['完成周报功能', '实现个性化建议'],
        challenges: ['时间管理需要改进'],
        insights: ['工作效率有所提升'],
        recommendations: ['继续保持良好的工作习惯'],
        metrics: {
          activeDays: 5,
          totalReports: 7,
          productivityTrend: 'improving'
        }
      }
    };
    
    res.json({ success: true, data: report });
  } catch (error) {
    logger.error('Failed to get report:', error);
    res.status(500).json({ success: false, error: 'Failed to get report' });
  }
});

// API路由 - 日志查看
router.get('/api/logs', async (req, res) => {
  try {
    const { level, limit = 100 } = req.query;
    
    // 这里应该从日志文件读取
    // 目前返回模拟数据
    const logs = [
      {
        timestamp: new Date('2025-01-06T10:30:15Z'),
        level: 'info',
        message: '系统启动完成',
        module: 'main'
      },
      {
        timestamp: new Date('2025-01-06T10:31:22Z'),
        level: 'info',
        message: '邮件服务初始化成功',
        module: 'emailService'
      },
      {
        timestamp: new Date('2025-01-06T10:32:10Z'),
        level: 'warn',
        message: 'AI服务响应较慢',
        module: 'aiService'
      },
      {
        timestamp: new Date('2025-01-06T10:35:45Z'),
        level: 'info',
        message: '周报生成任务完成',
        module: 'weeklyReportService'
      }
    ];
    
    let filteredLogs = logs;
    
    if (level && level !== 'all') {
      filteredLogs = filteredLogs.filter(log => log.level === level);
    }
    
    // 按时间倒序排列并限制数量
    filteredLogs = filteredLogs
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, parseInt(limit as string));
    
    res.json({ success: true, data: filteredLogs });
  } catch (error) {
    logger.error('Failed to get logs:', error);
    res.status(500).json({ success: false, error: 'Failed to get logs' });
  }
});

// API路由 - 配置管理
router.get('/api/settings', async (req, res) => {
  try {
    // 这里应该从配置文件或数据库获取设置
    // 目前返回模拟数据（不包含敏感信息）
    const settings = {
      email: {
        smtpHost: process.env.SMTP_HOST || '',
        smtpPort: process.env.SMTP_PORT || '',
        emailUser: process.env.EMAIL_USER || '',
        // 不返回密码等敏感信息
      },
      ai: {
        provider: process.env.AI_PROVIDER || 'mock',
        model: process.env.AI_MODEL || 'gpt-3.5-turbo'
      },
      schedule: {
        morningReminderTime: '09:00',
        eveningReminderTime: '18:00',
        timezone: 'Asia/Shanghai'
      }
    };
    
    res.json({ success: true, data: settings });
  } catch (error) {
    logger.error('Failed to get settings:', error);
    res.status(500).json({ success: false, error: 'Failed to get settings' });
  }
});

router.put('/api/settings', async (req, res) => {
  try {
    const { email, ai, schedule } = req.body;
    
    // 这里应该验证并保存配置到文件或数据库
    // 目前只是模拟保存
    logger.info('Settings update requested:', {
      email: email ? 'Updated' : 'No change',
      ai: ai ? 'Updated' : 'No change',
      schedule: schedule ? 'Updated' : 'No change'
    });
    
    res.json({ 
      success: true, 
      message: 'Settings updated successfully',
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Failed to update settings:', error);
    res.status(500).json({ success: false, error: 'Failed to update settings' });
  }
});

// API路由 - 统计数据
router.get('/api/dashboard/stats', async (req, res) => {
  try {
    const userService = new UserService();
    await userService.initialize();
    
    const users = userService.getAllUsers();
    const activeUsers = users.filter(user => user.isActive);
    
    const stats = {
      totalUsers: users.length,
      activeUsers: activeUsers.length,
      emailsSent: Math.floor(Math.random() * 50) + 10, // 模拟数据
      reportsGenerated: Math.floor(Math.random() * 20) + 5, // 模拟数据
      systemUptime: Math.floor(process.uptime() / 3600) + '小时',
      lastUpdate: new Date()
    };
    
    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('Failed to get dashboard stats:', error);
    res.status(500).json({ success: false, error: 'Failed to get dashboard stats' });
  }
});

// API路由 - 提醒状态
router.get('/api/reminder-status', async (req, res) => {
  try {
    const SchedulerService = require('../services/schedulerService').default;
    const schedulerService = new SchedulerService();
    
    const userId = req.query.userId as string || 'admin';
    const reminderStatus = schedulerService.getTodayReminderStatus(userId);
    
    res.json({ 
      success: true, 
      data: reminderStatus || {
        userId,
        date: new Date().toISOString().split('T')[0],
        morningReminderSent: false,
        eveningReminderSent: false,
        workReportReceived: false
      }
    });
  } catch (error) {
    logger.error('Failed to get reminder status:', error);
    res.status(500).json({ success: false, error: 'Failed to get reminder status' });
  }
});

// API路由 - 重置今天的提醒状态（用于测试）
router.post('/api/reminder-status/reset', async (req, res) => {
  try {
    const SchedulerService = require('../services/schedulerService').default;
    const schedulerService = new SchedulerService();
    
    const userId = req.body.userId || 'admin';
    await schedulerService.resetTodayReminders(userId);
    
    res.json({ 
      success: true, 
      message: `Reset today's reminder status for user ${userId}`,
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Failed to reset reminder status:', error);
    res.status(500).json({ success: false, error: 'Failed to reset reminder status' });
  }
});

export default router;