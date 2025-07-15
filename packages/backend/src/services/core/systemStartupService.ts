import EmailService from '../email/emailService';
import UserService from '../user/userService';
import logger from '../../utils/logger';
import config from '../../config/index';

class SystemStartupService {
  private emailService: EmailService;
  private userService: UserService;

  constructor() {
    this.emailService = new EmailService();
    this.userService = new UserService();
  }

  async initialize(): Promise<void> {
    await this.userService.initialize();
    logger.info('System startup service initialized');
  }

  /**
   * 系统启动时发送通知邮件给管理员
   */
  async sendStartupNotification(): Promise<void> {
    try {
      
      // 验证邮件连接
      const emailConnected = await this.emailService.verifyConnection();
      if (!emailConnected) {
        logger.warn('Email service not connected, skipping startup notification');
        return;
      }

      // 获取用户统计
      const userStats = this.userService.getStats();
      
      // 只发送管理员通知
      await this.emailService.sendSystemStartupNotification(userStats.total);
      logger.info('Admin startup notification sent');
      
      logger.info(`System startup notification sent to admin. Total users: ${userStats.total}`);
      
      // 在控制台也显示启动信息
      this.logStartupInfo(userStats);
      
    } catch (error) {
      logger.error('Failed to send startup notification:', error);
    }
  }

  /**
   * 在控制台记录启动信息
   */
  private logStartupInfo(userStats: { total: number; active: number; inactive: number }): void {
    const startupInfo = `
╭─────────────────────────────────────────────╮
│          📧 邮件助手系统已启动              │
├─────────────────────────────────────────────┤
│ 🕐 启动时间: ${new Date().toLocaleString().padEnd(21)} │
│ 👥 总用户数: ${userStats.total.toString().padEnd(21)} │
│ ✅ 活跃用户: ${userStats.active.toString().padEnd(21)} │
│ ❌ 禁用用户: ${userStats.inactive.toString().padEnd(21)} │
│ 🤖 AI 提供商: ${config.ai.provider.toUpperCase().padEnd(20)} │
│ 📨 邮件服务: 已连接${' '.repeat(17)} │
│ ⏰ 定时任务: 已启动${' '.repeat(17)} │
├─────────────────────────────────────────────┤
│ 💡 管理员可通过发送以 / 开头的邮件执行命令  │
│    例如: /adduser user@example.com 张三     │
│ 📧 启动/停止通知仅发送给管理员              │
├─────────────────────────────────────────────┤
│          系统正在为用户提供服务...          │
╰─────────────────────────────────────────────╯
    `;
    
    logger.info(startupInfo);
  }

  /**
   * 系统关闭时发送通知给管理员
   */
  async sendShutdownNotification(): Promise<void> {
    try {
      await this.userService.initialize();
      
      // 只发送管理员通知
      const adminSubject = `⚠️ 邮件助手系统关闭通知`;
      const adminContent = `
亲爱的管理员，

邮件助手系统正在关闭。

🕐 关闭时间：${new Date().toLocaleString()}
📊 运行状态：正常关闭
⚡ 所有服务已安全停止

如需重新启动系统，请检查服务器状态。

此致，
邮件助手系统
      `.trim();

      await this.emailService.sendEmail(adminSubject, adminContent);
      logger.info('Admin shutdown notification sent');
      
      logger.info('System shutdown notification sent to admin');
      
    } catch (error) {
      logger.error('Failed to send shutdown notification:', error);
    }
  }

  /**
   * 向所有非管理员用户发送系统启动通知（已禁用，仅供测试使用）
   */
  private async sendUserStartupNotifications(): Promise<void> {
    try {
      const users = this.userService.getAllUsers();
      const activeUsers = users.filter(user => user.isActive);
      
      if (activeUsers.length === 0) {
        logger.debug('No active users found, skipping user startup notifications');
        return;
      }

      const subject = `🎉 邮件助手系统已重新上线`;
      
      let successCount = 0;
      let failureCount = 0;

      for (const user of activeUsers) {
        try {
          const content = `
您好 ${user.name}，

邮件助手系统已成功重新启动，现在可以正常为您提供服务了！

🕐 启动时间：${new Date().toLocaleString()}
🤖 AI 助手：${config.ai.provider.toUpperCase()}
✨ 服务状态：所有功能正常运行

您可以：
• 发送工作报告，我将为您生成智能总结
• 接收每日日程提醒和个性化建议
• 通过邮件与AI助手互动
• 管理您的提醒时间设置

如果您有任何问题或需要帮助，请随时回复此邮件。

祝您工作愉快！

此致，
您的邮件助手
          `.trim();

          await this.emailService.sendEmailToUser(user.email, subject, content);
          successCount++;
          
        } catch (error) {
          logger.error(`Failed to send startup notification to user ${user.email}:`, error);
          failureCount++;
        }
      }

      logger.debug(`User startup notifications sent: ${successCount} success, ${failureCount} failed`);
      
    } catch (error) {
      logger.error('Failed to send user startup notifications:', error);
    }
  }

  /**
   * 向所有非管理员用户发送系统停止通知（已禁用，仅供测试使用）
   */
  private async sendUserShutdownNotifications(): Promise<void> {
    try {
      const users = this.userService.getAllUsers();
      const activeUsers = users.filter(user => user.isActive);
      
      if (activeUsers.length === 0) {
        logger.debug('No active users found, skipping user shutdown notifications');
        return;
      }

      const subject = `⚠️ 邮件助手系统维护通知`;
      
      let successCount = 0;
      let failureCount = 0;

      for (const user of activeUsers) {
        try {
          const content = `
您好 ${user.name}，

邮件助手系统将进行维护，暂时无法提供服务。

🕐 维护时间：${new Date().toLocaleString()}
🔧 维护类型：系统更新/重启
⏱️ 预计恢复：维护完成后系统将自动恢复服务

在此期间：
• 您发送的邮件将在系统恢复后处理
• 定时提醒将在恢复后正常发送
• 所有数据都已安全保存

系统恢复后，您将收到确认通知。给您带来的不便，我们深表歉意。

感谢您的理解与支持！

此致，
邮件助手系统
          `.trim();

          await this.emailService.sendEmailToUser(user.email, subject, content);
          successCount++;
          
        } catch (error) {
          logger.error(`Failed to send shutdown notification to user ${user.email}:`, error);
          failureCount++;
        }
      }

      logger.debug(`User shutdown notifications sent: ${successCount} success, ${failureCount} failed`);
      
    } catch (error) {
      logger.error('Failed to send user shutdown notifications:', error);
    }
  }

  /**
   * 测试用户通知功能
   */
  async testUserNotifications(): Promise<void> {
    try {
      logger.debug('Testing user notification system...');
      
      await this.userService.initialize();
      const users = this.userService.getAllUsers();
      const activeUsers = users.filter(user => user.isActive);
      
      if (activeUsers.length === 0) {
        logger.debug('No active users found for testing');
        return;
      }

      const subject = `🧪 邮件助手系统测试通知`;
      
      for (const user of activeUsers.slice(0, 1)) { // 只发送给第一个用户进行测试
        const content = `
您好 ${user.name}，

这是一条测试通知，用于验证邮件助手系统的用户通知功能。

🧪 测试时间：${new Date().toLocaleString()}
✅ 如果您收到此邮件，说明通知系统工作正常

您无需回复此邮件。

此致，
邮件助手系统测试
        `.trim();

        await this.emailService.sendEmailToUser(user.email, subject, content);
        logger.debug(`Test notification sent to user: ${user.email}`);
        break; // 只发送给一个用户进行测试
      }
      
    } catch (error) {
      logger.error('Failed to send test user notification:', error);
    }
  }

  /**
   * 发送系统健康检查报告（可选功能）
   */
  async sendHealthReport(): Promise<void> {
    try {
      await this.userService.initialize();
      const userStats = this.userService.getStats();
      
      const subject = `📊 邮件助手系统健康报告`;
      const content = `
亲爱的管理员，

这是您的邮件助手系统健康报告：

📈 用户统计：
• 总用户数：${userStats.total}
• 活跃用户：${userStats.active}
• 禁用用户：${userStats.inactive}

🔧 系统状态：
• AI服务商：${config.ai.provider.toUpperCase()}
• 邮件服务：正常运行
• 定时任务：正常运行
• 系统时间：${new Date().toLocaleString()}

✅ 所有服务运行正常。

此致，
邮件助手系统监控
      `.trim();

      await this.emailService.sendEmail(subject, content);
      logger.info('Health report sent to admin');
      
    } catch (error) {
      logger.error('Failed to send health report:', error);
    }
  }
}

export default SystemStartupService;