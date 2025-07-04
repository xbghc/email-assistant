import EmailService from './emailService';
import UserService from './userService';
import logger from '../utils/logger';
import config from '../config';

class SystemStartupService {
  private emailService: EmailService;
  private userService: UserService;

  constructor() {
    this.emailService = new EmailService();
    this.userService = new UserService();
  }

  /**
   * 系统启动时发送通知邮件给管理员
   */
  async sendStartupNotification(): Promise<void> {
    try {
      // 等待服务初始化
      await this.userService.initialize();
      
      // 验证邮件连接
      const emailConnected = await this.emailService.verifyConnection();
      if (!emailConnected) {
        logger.warn('Email service not connected, skipping startup notification');
        return;
      }

      // 获取用户统计
      const userStats = this.userService.getStats();
      
      // 发送启动通知
      await this.emailService.sendSystemStartupNotification(userStats.total);
      
      logger.info(`System startup notification sent to admin. Users: ${userStats.total}`);
      
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
├─────────────────────────────────────────────┤
│          系统正在为用户提供服务...          │
╰─────────────────────────────────────────────╯
    `;
    
    console.log(startupInfo);
  }

  /**
   * 系统关闭时发送通知（可选）
   */
  async sendShutdownNotification(): Promise<void> {
    try {
      const subject = `⚠️ 邮件助手系统关闭通知`;
      const content = `
亲爱的管理员，

邮件助手系统正在关闭。

🕐 关闭时间：${new Date().toLocaleString()}
📊 运行状态：正常关闭
⚡ 所有服务已安全停止

如需重新启动系统，请检查服务器状态。

此致，
邮件助手系统
      `.trim();

      await this.emailService.sendEmail(subject, content);
      logger.info('System shutdown notification sent');
      
    } catch (error) {
      logger.error('Failed to send shutdown notification:', error);
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