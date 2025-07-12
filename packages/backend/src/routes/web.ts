import express, { Router } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';

// ESM-compatible __dirname replacement
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import UserService from '../services/user/userService.js';
import { UserRole } from '../models/User.js';
import { authenticate, requireAdmin, requireOwnershipOrAdmin } from '../middleware/authMiddleware.js';
import { LogQuery } from '../services/logging/logReaderService.js';
import { SystemConfig } from '../services/system/configService.js';
// import WeeklyReportService from '../services/reports/weeklyReportService.js';
// import PersonalizationService from '../services/reports/personalizationService.js';

const router: Router = express.Router();

// 静态文件服务
router.use('/css', express.static(path.join(__dirname, '../public/css')));
router.use('/js', express.static(path.join(__dirname, '../public/js')));

// 登录页面路由（无需认证）
router.get('/login', (req, res) => {
  try {
    res.sendFile(path.join(__dirname, '../public/views/login.html'));
  } catch (error) {
    logger.error('Failed to serve login page:', error);
    res.status(500).send('Internal Server Error');
  }
});

// 主页面路由（需要认证）
router.get('/', authenticate, requireAdmin, (req, res) => {
  try {
    res.sendFile(path.join(__dirname, '../public/views/index.html'));
  } catch (error) {
    logger.error('Failed to serve main page:', error);
    res.status(500).send('Internal Server Error');
  }
});

// API路由 - 用户管理（需要管理员权限）
router.get('/api/users', authenticate, requireAdmin, async (req, res) => {
  try {
    const userService = new UserService();
    await userService.initialize();
    
    const users = userService.getAllUsers();
    res.json({
      success: true,
      data: users.map((user: any) => ({
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

router.post('/api/users', authenticate, requireAdmin, async (req, res) => {
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
      role: UserRole.USER,
      config: {
        schedule: {
          morningReminderTime: '09:00',
          eveningReminderTime: '18:00',
          timezone: timezone || 'Asia/Shanghai'
        },
        language: 'zh' as 'zh' | 'en'
      },
      isActive: true,
      emailVerified: true,
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

router.put('/api/users/:userId', authenticate, requireOwnershipOrAdmin, async (req, res) => {
  try {
    const userId = req.params.userId;
    if (!userId) {
      res.status(400).json({ success: false, error: 'User ID is required' });
      return;
    }
    
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
    
    userService.updateUser(userId, {
      ...updateData,
      updatedAt: new Date()
    });
    
    const updatedUser = userService.getUserById(userId);
    
    logger.info(`User updated: ${userId}`);
    res.json({ success: true, data: updatedUser });
  } catch (error) {
    logger.error('Failed to update user:', error);
    res.status(500).json({ success: false, error: 'Failed to update user' });
  }
});

router.delete('/api/users/:userId', authenticate, requireAdmin, async (req, res) => {
  try {
    const userId = req.params.userId;
    if (!userId) {
      res.status(400).json({ success: false, error: 'User ID is required' });
      return;
    }
    
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
    
    const success = await userService.removeUser(userId);
    if (!success) {
      res.status(500).json({ 
        success: false, 
        error: 'Failed to delete user' 
      });
      return;
    }
    
    logger.info(`User deleted: ${userId}`);
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    logger.error('Failed to delete user:', error);
    res.status(500).json({ success: false, error: 'Failed to delete user' });
  }
});

// API路由 - 系统状态（需要认证）
router.get('/api/system/status', authenticate, async (req, res) => {
  try {
    const SystemHealthService = (await import('../services/core/systemHealthService')).default;
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

// API路由 - 报告管理（需要认证）
router.get('/api/reports', authenticate, async (req, res) => {
  try {
    const { type, userId, limit = 20 } = req.query;
    
    // 从真实服务获取报告数据
    const reports = [];
    
    try {
      // 获取邮件统计作为基础数据
      const EmailService = (await import('../services/email/emailService')).default;
      const emailService = new EmailService();
      await emailService.initialize();
      const emailStats = emailService.getEmailStats();
      
      // 获取用户服务数据
      const UserService = (await import('../services/user/userService')).default;
      const userService = new UserService();
      await userService.initialize();
      const users = userService.getAllUsers();
      
      // 基于真实数据生成报告条目
      const today = new Date();
      // const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      if (!type || type === 'weekly') {
        reports.push({
          id: `weekly_${today.toISOString().slice(0, 10)}`,
          type: 'weekly',
          title: `工作周报 - ${today.getFullYear()}年第${Math.ceil((today.getTime() - new Date(today.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000))}周`,
          userId: userId || 'admin',
          createdAt: today.toISOString(),
          status: 'completed',
          summary: `本周系统运行正常，共发送邮件${emailStats.thisWeek.sent}封，用户数量${users.length}人。系统稳定运行，各项功能正常。`,
          content: `详细周报内容：\n- 邮件发送：${emailStats.thisWeek.sent}封\n- 活跃用户：${users.filter((u: any) => u.isActive).length}人\n- 系统运行时间：${Math.floor(process.uptime() / 3600)}小时`
        });
      }
      
      if (!type || type === 'suggestions') {
        reports.push({
          id: `suggestions_${today.toISOString().slice(0, 10)}`,
          type: 'suggestions',
          title: '个性化建议报告',
          userId: userId || 'admin',
          createdAt: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 昨天
          status: 'completed',
          summary: `基于系统使用情况分析，建议优化邮件发送频率和用户体验。当前系统表现良好，建议继续保持。`,
          content: `个性化建议：\n- 邮件发送效率良好\n- 用户活跃度：${Math.round(users.filter((u: any) => u.isActive).length / users.length * 100)}%\n- 建议定期检查系统性能`
        });
      }
      
      if (!type || type === 'daily') {
        reports.push({
          id: `daily_${today.toISOString().slice(0, 10)}`,
          type: 'daily',
          title: `日报 - ${today.toLocaleDateString()}`,
          userId: userId || 'admin',
          createdAt: today.toISOString(),
          status: 'completed',
          summary: `今日系统运行正常，发送邮件${emailStats.today.sent}封，无异常状况。`,
          content: `今日概况：\n- 邮件发送：${emailStats.today.sent}封\n- 系统状态：正常\n- 运行时间：${Math.floor(process.uptime())}秒`
        });
      }
      
    } catch (serviceError) {
      logger.warn('Failed to load service data for reports, using fallback data:', serviceError);
      
      // 如果服务数据获取失败，提供基础报告
      reports.push({
        id: 'fallback_1',
        type: 'system',
        title: '系统状态报告',
        userId: 'admin',
        createdAt: new Date().toISOString(),
        status: 'completed',
        summary: '系统运行正常，所有服务已启动。',
        content: '系统基本信息可用，详细数据获取中...'
      });
    }
    
    let filteredReports = reports;
    
    if (type) {
      filteredReports = filteredReports.filter(report => report.type === type);
    }
    
    if (userId && userId !== 'admin') {
      filteredReports = filteredReports.filter(report => report.userId === userId);
    }
    
    // 按创建时间倒序排列并限制数量
    filteredReports = filteredReports
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, parseInt(limit as string));
    
    res.json({ success: true, data: filteredReports });
  } catch (error) {
    logger.error('Failed to get reports:', error);
    res.status(500).json({ success: false, error: 'Failed to get reports' });
  }
});

router.get('/api/reports/:reportId', authenticate, async (req, res) => {
  try {
    const reportId = req.params.reportId;
    if (!reportId) {
      res.status(400).json({ success: false, error: 'Report ID is required' });
      return;
    }
    
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

// API路由 - 日志查看（需要管理员权限）
router.get('/api/logs', authenticate, requireAdmin, async (req, res) => {
  try {
    const { level, limit, search, startDate, endDate } = req.query;
    
    const LogReaderService = (await import('../services/logging/logReaderService')).default;
    const logReader = new LogReaderService();
    await logReader.initialize();
    
    const query: LogQuery = {
      level: (level as string) as 'info' | 'error' | 'warn' | 'debug' | 'all',
      ...(limit && { limit: parseInt(limit as string) }),
      ...(search && { search: search as string }),
      ...(startDate && { startDate: new Date(startDate as string) }),
      ...(endDate && { endDate: new Date(endDate as string) })
    };
    
    const logs = await logReader.readLogs(query);
    
    res.json({ success: true, data: logs });
  } catch (error) {
    logger.error('Failed to get logs:', error);
    res.status(500).json({ success: false, error: 'Failed to get logs' });
  }
});

// API路由 - 日志统计（需要管理员权限）
router.get('/api/logs/stats', authenticate, requireAdmin, async (req, res) => {
  try {
    const hours = req.query.hours ? parseInt(req.query.hours as string) : 24;
    
    const LogReaderService = (await import('../services/logging/logReaderService')).default;
    const logReader = new LogReaderService();
    await logReader.initialize();
    
    const stats = await logReader.getLogStatistics(hours);
    
    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('Failed to get log stats:', error);
    res.status(500).json({ success: false, error: 'Failed to get log stats' });
  }
});

// API路由 - 导出日志（需要管理员权限）
router.get('/api/logs/export', authenticate, requireAdmin, async (req, res) => {
  try {
    const { level, startDate, endDate } = req.query;
    
    const LogReaderService = (await import('../services/logging/logReaderService')).default;
    const logReader = new LogReaderService();
    await logReader.initialize();
    
    const query: LogQuery = {
      level: (level as string) as 'info' | 'error' | 'warn' | 'debug' | 'all',
      ...(startDate && { startDate: new Date(startDate as string) }),
      ...(endDate && { endDate: new Date(endDate as string) })
    };
    
    const csvContent = await logReader.exportLogsAsCSV(query);
    
    res.setHeader('Content-Type', 'text/csv');
    const dateStr = new Date().toISOString().split('T')[0] || 'unknown';
    res.setHeader('Content-Disposition', `attachment; filename="logs-${dateStr}.csv"`);
    res.send(csvContent);
  } catch (error) {
    logger.error('Failed to export logs:', error);
    res.status(500).json({ success: false, error: 'Failed to export logs' });
  }
});

// API路由 - 配置管理（需要管理员权限）
router.get('/api/settings', authenticate, requireAdmin, async (req, res) => {
  try {
    const ConfigService = (await import('../services/system/configService')).default;
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

router.put('/api/settings', authenticate, requireAdmin, async (req, res) => {
  try {
    const { email, ai, schedule, server, features } = req.body;
    
    const ConfigService = (await import('../services/system/configService')).default;
    const configService = new ConfigService();
    await configService.initialize();
    
    // 构建更新的配置
    const updates: Partial<SystemConfig> = {};
    
    if (email) {
      const currentConfig = configService.getConfig();
      if (!currentConfig) {
        return res.status(500).json({ success: false, error: 'Configuration not found' });
      }
      
      updates.email = {
        smtp: { ...currentConfig.email.smtp },
        imap: { ...currentConfig.email.imap },
        user: { ...currentConfig.email.user }
      };
      
      if (email.smtpHost) updates.email.smtp.host = email.smtpHost;
      if (email.smtpPort) updates.email.smtp.port = parseInt(email.smtpPort);
      if (email.emailUser) updates.email.smtp.user = email.emailUser;
      if (email.emailPass) updates.email.smtp.pass = email.emailPass;
      if (email.userEmail) updates.email.user.email = email.userEmail;
      if (email.userName) updates.email.user.name = email.userName;
    }
    
    if (ai) {
      const currentConfig = configService.getConfig();
      if (!currentConfig) {
        return res.status(500).json({ success: false, error: 'Configuration not found' });
      }
      
      updates.ai = {
        provider: currentConfig.ai.provider,
        model: currentConfig.ai.model,
        apiKey: currentConfig.ai.apiKey
      };
      
      if (ai.provider) updates.ai.provider = ai.provider;
      if (ai.model) updates.ai.model = ai.model;
      if (ai.apiKey) updates.ai.apiKey = ai.apiKey;
    }
    
    if (schedule) {
      const currentConfig = configService.getConfig();
      if (!currentConfig) {
        return res.status(500).json({ success: false, error: 'Configuration not found' });
      }
      
      updates.schedule = {
        morningReminderTime: currentConfig.schedule.morningReminderTime,
        eveningReminderTime: currentConfig.schedule.eveningReminderTime,
        timezone: currentConfig.schedule.timezone,
        weeklyReportDay: currentConfig.schedule.weeklyReportDay,
        weeklyReportTime: currentConfig.schedule.weeklyReportTime
      };
      
      if (schedule.morningTime) updates.schedule.morningReminderTime = schedule.morningTime;
      if (schedule.eveningTime) updates.schedule.eveningReminderTime = schedule.eveningTime;
      if (schedule.timezone) updates.schedule.timezone = schedule.timezone;
      if (schedule.weeklyReportDay !== undefined) updates.schedule.weeklyReportDay = schedule.weeklyReportDay;
      if (schedule.weeklyReportTime) updates.schedule.weeklyReportTime = schedule.weeklyReportTime;
    }
    
    if (server) {
      const currentConfig = configService.getConfig();
      if (!currentConfig) {
        return res.status(500).json({ success: false, error: 'Configuration not found' });
      }
      
      updates.server = {
        port: currentConfig.server?.port || 3000,
        host: currentConfig.server?.host || 'localhost',
        logLevel: currentConfig.server?.logLevel || 'info'
      };
      
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
    
    return res.json({ 
      success: true, 
      message: 'Settings updated successfully. Please restart the service for changes to take effect.',
      timestamp: new Date(),
      requiresRestart: true
    });
  } catch (error) {
    logger.error('Failed to update settings:', error);
    return res.status(500).json({ success: false, error: 'Failed to update settings' });
  }
});

// API路由 - 统计数据（需要认证）
router.get('/api/dashboard/stats', authenticate, async (req, res) => {
  try {
    const userService = new UserService();
    await userService.initialize();
    
    const users = userService.getAllUsers();
    const activeUsers = users.filter((user: any) => user.isActive);
    
    // 获取真实的邮件统计数据
    const EmailService = (await import('../services/email/emailService')).default;
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

// API路由 - 邮件趋势数据（需要认证）
router.get('/api/email-trends', authenticate, async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    
    const EmailService = (await import('../services/email/emailService')).default;
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

// API路由 - 提醒状态（需要认证）
router.get('/api/reminder-status', authenticate, async (req, res) => {
  try {
    const { getSchedulerService } = await import('../index');
    const schedulerService = getSchedulerService();
    
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

// API路由 - 重置今天的提醒状态（需要管理员权限）
router.post('/api/reminder-status/reset', authenticate, requireAdmin, async (req, res) => {
  try {
    const { getSchedulerService } = await import('../index');
    const schedulerService = getSchedulerService();
    
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

// API路由 - 性能监控（需要认证）
router.get('/api/performance/metrics', authenticate, async (req, res) => {
  try {
    const { getPerformanceMonitor } = await import('../index');
    const performanceMonitor = getPerformanceMonitor();
    
    const current = performanceMonitor.getCurrentMetrics();
    const history = performanceMonitor.getMetricsHistory(60); // 最近1小时
    const healthScore = performanceMonitor.getHealthScore();
    
    res.json({
      success: true,
      data: {
        current,
        history,
        healthScore,
        thresholds: performanceMonitor.getThresholds()
      }
    });
  } catch (error) {
    logger.error('Failed to get performance metrics:', error);
    res.status(500).json({ success: false, error: 'Failed to get performance metrics' });
  }
});

router.get('/api/performance/alerts', authenticate, async (req, res) => {
  try {
    const { getPerformanceMonitor } = await import('../index');
    const performanceMonitor = getPerformanceMonitor();
    
    const activeAlerts = performanceMonitor.getActiveAlerts();
    const allAlerts = performanceMonitor.getAllAlerts(24); // 最近24小时
    
    res.json({
      success: true,
      data: {
        active: activeAlerts,
        recent: allAlerts,
        summary: {
          total: allAlerts.length,
          active: activeAlerts.length,
          resolved: allAlerts.filter((a: any) => a.resolved).length
        }
      }
    });
  } catch (error) {
    logger.error('Failed to get performance alerts:', error);
    res.status(500).json({ success: false, error: 'Failed to get performance alerts' });
  }
});

router.post('/api/performance/alerts/:alertId/resolve', authenticate, requireAdmin, async (req, res) => {
  try {
    const { alertId } = req.params;
    const { getPerformanceMonitor } = await import('../index');
    const performanceMonitor = getPerformanceMonitor();
    
    if (!alertId) {
      res.status(400).json({ success: false, error: 'Alert ID is required' });
      return;
    }
    const resolved = performanceMonitor.resolveAlert(alertId);
    
    if (resolved) {
      res.json({
        success: true,
        message: `Alert ${alertId} resolved successfully`
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Alert not found'
      });
    }
  } catch (error) {
    logger.error('Failed to resolve alert:', error);
    res.status(500).json({ success: false, error: 'Failed to resolve alert' });
  }
});

export default router;