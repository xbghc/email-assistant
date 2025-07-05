import express from 'express';
import path from 'path';
import logger from '../utils/logger';
import UserService from '../services/userService';
// import WeeklyReportService from '../services/weeklyReportService';
// import PersonalizationService from '../services/personalizationService';

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
    const SystemHealthService = require('../services/systemHealthService').default;
    const healthService = new SystemHealthService();
    await healthService.initialize();
    
    const systemHealth = await healthService.getSystemHealth();
    
    // 转换为 web 界面期望的格式
    const systemStatus = {
      services: systemHealth.services.map((service: any) => ({
        name: service.name,
        status: service.status === 'healthy' ? 'running' : 
               service.status === 'warning' ? 'warning' : 'error',
        description: service.message,
        uptime: service.responseTime ? `${service.responseTime}ms` : undefined,
        lastChecked: service.lastChecked
      })),
      metrics: {
        memoryUsage: systemHealth.metrics.memoryUsage,
        cpuUsage: process.cpuUsage(),
        uptime: systemHealth.metrics.uptime,
        version: systemHealth.version,
        emailsToday: systemHealth.metrics.emailsToday,
        errorsLastHour: systemHealth.metrics.errorsLastHour,
        warningsLastHour: systemHealth.metrics.warningsLastHour
      },
      timestamp: systemHealth.lastChecked,
      overall: systemHealth.overall
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
    const { level, limit, search, startDate, endDate } = req.query;
    
    const LogReaderService = require('../services/logReaderService').default;
    const logReader = new LogReaderService();
    await logReader.initialize();
    
    const query = {
      level: level as any,
      limit: limit ? parseInt(limit as string) : undefined,
      search: search as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined
    };
    
    const logs = await logReader.readLogs(query);
    
    res.json({ success: true, data: logs });
  } catch (error) {
    logger.error('Failed to get logs:', error);
    res.status(500).json({ success: false, error: 'Failed to get logs' });
  }
});

// API路由 - 日志统计
router.get('/api/logs/stats', async (req, res) => {
  try {
    const hours = req.query.hours ? parseInt(req.query.hours as string) : 24;
    
    const LogReaderService = require('../services/logReaderService').default;
    const logReader = new LogReaderService();
    await logReader.initialize();
    
    const stats = await logReader.getLogStatistics(hours);
    
    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('Failed to get log stats:', error);
    res.status(500).json({ success: false, error: 'Failed to get log stats' });
  }
});

// API路由 - 导出日志
router.get('/api/logs/export', async (req, res) => {
  try {
    const { level, startDate, endDate } = req.query;
    
    const LogReaderService = require('../services/logReaderService').default;
    const logReader = new LogReaderService();
    await logReader.initialize();
    
    const query = {
      level: level as any,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined
    };
    
    const csvContent = await logReader.exportLogsAsCSV(query);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="logs-${new Date().toISOString().split('T')[0]!}.csv"`);
    res.send(csvContent);
  } catch (error) {
    logger.error('Failed to export logs:', error);
    res.status(500).json({ success: false, error: 'Failed to export logs' });
  }
});

// API路由 - 配置管理
router.get('/api/settings', async (req, res) => {
  try {
    const ConfigService = require('../services/configService').default;
    const configService = new ConfigService();
    await configService.initialize();
    
    const config = configService.getConfig();
    if (!config) {
      return res.status(404).json({ success: false, error: 'Configuration not found' });
    }
    
    // 返回安全的配置（不包含敏感信息）
    const safeConfig = {
      email: {
        smtpHost: config.email.smtp.host,
        smtpPort: config.email.smtp.port,
        emailUser: config.email.smtp.user,
        userEmail: config.email.user.email,
        userName: config.email.user.name
      },
      ai: {
        provider: config.ai.provider,
        model: config.ai.model,
        hasApiKey: !!config.ai.apiKey
      },
      schedule: {
        morningTime: config.schedule.morningReminderTime,
        eveningTime: config.schedule.eveningReminderTime,
        timezone: config.schedule.timezone,
        weeklyReportDay: config.schedule.weeklyReportDay,
        weeklyReportTime: config.schedule.weeklyReportTime
      },
      server: {
        port: config.server.port,
        host: config.server.host,
        logLevel: config.server.logLevel
      },
      features: config.features
    };
    
    return res.json({ success: true, data: safeConfig });
  } catch (error) {
    logger.error('Failed to get settings:', error);
    return res.status(500).json({ success: false, error: 'Failed to get settings' });
  }
});

router.put('/api/settings', async (req, res) => {
  try {
    const { email, ai, schedule, server, features } = req.body;
    
    const ConfigService = require('../services/configService').default;
    const configService = new ConfigService();
    await configService.initialize();
    
    // 构建更新的配置
    const updates: any = {};
    
    if (email) {
      updates.email = {};
      if (email.smtpHost) updates.email.smtp = { ...updates.email.smtp, host: email.smtpHost };
      if (email.smtpPort) updates.email.smtp = { ...updates.email.smtp, port: parseInt(email.smtpPort) };
      if (email.emailUser) updates.email.smtp = { ...updates.email.smtp, user: email.emailUser };
      if (email.emailPass) updates.email.smtp = { ...updates.email.smtp, pass: email.emailPass };
      if (email.userEmail) updates.email.user = { ...updates.email.user, email: email.userEmail };
      if (email.userName) updates.email.user = { ...updates.email.user, name: email.userName };
    }
    
    if (ai) {
      updates.ai = {};
      if (ai.provider) updates.ai.provider = ai.provider;
      if (ai.model) updates.ai.model = ai.model;
      if (ai.apiKey) updates.ai.apiKey = ai.apiKey;
    }
    
    if (schedule) {
      updates.schedule = {};
      if (schedule.morningTime) updates.schedule.morningReminderTime = schedule.morningTime;
      if (schedule.eveningTime) updates.schedule.eveningReminderTime = schedule.eveningTime;
      if (schedule.timezone) updates.schedule.timezone = schedule.timezone;
      if (schedule.weeklyReportDay !== undefined) updates.schedule.weeklyReportDay = schedule.weeklyReportDay;
      if (schedule.weeklyReportTime) updates.schedule.weeklyReportTime = schedule.weeklyReportTime;
    }
    
    if (server) {
      updates.server = {};
      if (server.port) updates.server.port = parseInt(server.port);
      if (server.host) updates.server.host = server.host;
      if (server.logLevel) updates.server.logLevel = server.logLevel;
    }
    
    if (features) {
      updates.features = features;
    }
    
    // 保存配置
    await configService.saveConfig(updates);
    
    logger.info('Settings updated successfully', { updatedSections: Object.keys(updates) });
    
    res.json({ 
      success: true, 
      message: 'Settings updated successfully. Please restart the service for changes to take effect.',
      timestamp: new Date(),
      requiresRestart: true
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
    
    // 获取真实的邮件统计数据
    const EmailService = require('../services/emailService').default;
    const emailService = new EmailService();
    await emailService.initialize();
    const emailStats = emailService.getEmailStats();
    
    const stats = {
      totalUsers: users.length,
      activeUsers: activeUsers.length,
      emailsSent: emailStats.today.sent, // 真实数据：今日已发送邮件
      reportsGenerated: emailStats.today.byType.report || 0, // 真实数据：今日生成报告数
      systemUptime: Math.floor(process.uptime() / 3600) + '小时',
      lastUpdate: new Date(),
      emailStats: {
        today: emailStats.today,
        thisWeek: emailStats.thisWeek,
        thisMonth: emailStats.thisMonth
      }
    };
    
    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('Failed to get dashboard stats:', error);
    res.status(500).json({ success: false, error: 'Failed to get dashboard stats' });
  }
});

// API路由 - 邮件趋势数据
router.get('/api/email-trends', async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    
    const EmailService = require('../services/emailService').default;
    const emailService = new EmailService();
    await emailService.initialize();
    
    const trendData = emailService.getEmailTrendData(days);
    
    res.json({ 
      success: true, 
      data: trendData 
    });
  } catch (error) {
    logger.error('Failed to get email trends:', error);
    res.status(500).json({ success: false, error: 'Failed to get email trends' });
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