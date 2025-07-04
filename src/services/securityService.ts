import logger from '../utils/logger';
import UserService from './userService';
import EmailService from './emailService';
import config from '../config';

interface SecurityViolation {
  userId: string;
  userEmail: string;
  command: string;
  timestamp: Date;
  ipAddress?: string;
}

class SecurityService {
  private userService: UserService;
  private emailService: EmailService;
  private violationHistory: Map<string, SecurityViolation[]> = new Map();
  private readonly MAX_VIOLATIONS = 3;

  constructor(userService: UserService) {
    this.userService = userService;
    this.emailService = new EmailService();
  }

  /**
   * 记录未授权访问尝试
   * @param userEmail 用户邮箱
   * @param command 尝试执行的命令
   * @returns 是否应该禁用用户
   */
  async recordUnauthorizedAccess(userEmail: string, command: string): Promise<boolean> {
    const user = this.userService.getUserByEmail(userEmail);
    if (!user) {
      logger.warn(`Unknown user attempted unauthorized access: ${userEmail}`);
      return false;
    }

    const violation: SecurityViolation = {
      userId: user.id,
      userEmail,
      command,
      timestamp: new Date()
    };

    // 获取用户的违规历史
    const userViolations = this.violationHistory.get(user.id) || [];
    userViolations.push(violation);
    this.violationHistory.set(user.id, userViolations);

    logger.warn(`Security violation recorded for user ${userEmail}: ${command}`);

    // 发送警告邮件给管理员
    await this.sendSecurityWarningToAdmin(violation, userViolations.length);

    // 检查是否超过阈值
    if (userViolations.length >= this.MAX_VIOLATIONS) {
      await this.disableUserForSecurityViolations(user.id, userEmail, userViolations);
      return true;
    }

    return false;
  }

  /**
   * 发送安全警告邮件给管理员
   */
  private async sendSecurityWarningToAdmin(
    violation: SecurityViolation, 
    totalViolations: number
  ): Promise<void> {
    try {
      const isLastWarning = totalViolations >= this.MAX_VIOLATIONS;
      const subject = isLastWarning 
        ? `🚨 严重安全警告 - 用户已被禁用`
        : `⚠️ 安全警告 - 未授权访问尝试 (${totalViolations}/${this.MAX_VIOLATIONS})`;

      const content = `
亲爱的管理员，

检测到安全违规行为：

🚨 违规详情：
• 用户邮箱：${violation.userEmail}
• 尝试命令：${violation.command}
• 违规时间：${violation.timestamp.toLocaleString()}
• 累计违规：${totalViolations} 次

${isLastWarning ? `
🔒 自动处理：
• 用户已被自动禁用
• 服务访问已停止
• 建议进一步调查
` : `
⚡ 后续动作：
• 还有 ${this.MAX_VIOLATIONS - totalViolations} 次警告机会
• 达到 ${this.MAX_VIOLATIONS} 次将自动禁用用户
• 建议联系用户了解情况
`}

💡 建议：
1. 检查用户是否理解系统使用规则
2. 确认是否为误操作
3. 考虑提供用户培训

${isLastWarning ? '用户已被禁用，如需恢复请使用 /enableuser 命令。' : ''}

此致，
邮件助手安全系统
      `.trim();

      await this.emailService.sendEmail(subject, content);
      logger.info(`Security warning sent to admin for user ${violation.userEmail}`);

    } catch (error) {
      logger.error('Failed to send security warning:', error);
    }
  }

  /**
   * 因安全违规禁用用户
   */
  private async disableUserForSecurityViolations(
    userId: string, 
    userEmail: string, 
    violations: SecurityViolation[]
  ): Promise<void> {
    try {
      // 禁用用户
      this.userService.updateUser(userId, { isActive: false });

      // 发送禁用通知邮件给用户
      await this.sendSecurityDisableNotificationToUser(userEmail, violations);

      logger.warn(`User ${userEmail} disabled due to security violations`);

    } catch (error) {
      logger.error(`Failed to disable user ${userEmail}:`, error);
    }
  }

  /**
   * 发送禁用通知给用户
   */
  private async sendSecurityDisableNotificationToUser(
    userEmail: string, 
    violations: SecurityViolation[]
  ): Promise<void> {
    try {
      const subject = `🚨 账户已被暂停 - 安全违规`;
      const content = `
亲爱的用户，

您的邮件助手账户因多次安全违规已被暂停。

🚨 违规记录：
${violations.map((v, index) => 
  `${index + 1}. ${v.timestamp.toLocaleString()} - 尝试执行：${v.command}`
).join('\n')}

🔒 账户状态：
• 服务已暂停
• 无法接收智能邮件回复
• 定时提醒已停止

📞 申诉流程：
1. 联系管理员说明情况
2. 确认了解系统使用规则
3. 承诺遵守使用规范

💡 提醒：
邮件助手的管理员命令（以/开头）仅限管理员使用。
普通用户请使用自然语言与AI助手对话。

如有疑问，请联系系统管理员。

此致，
邮件助手安全系统
      `.trim();

      await this.emailService.sendEmail(subject, content, false, userEmail);

    } catch (error) {
      logger.error('Failed to send disable notification to user:', error);
    }
  }

  /**
   * 获取用户违规历史
   */
  getViolationHistory(userId: string): SecurityViolation[] {
    return this.violationHistory.get(userId) || [];
  }

  /**
   * 清除用户违规历史（用户恢复时）
   */
  clearViolationHistory(userId: string): void {
    this.violationHistory.delete(userId);
    logger.info(`Cleared violation history for user ${userId}`);
  }

  /**
   * 获取所有违规统计
   */
  getSecurityStats(): {
    totalViolations: number;
    usersWithViolations: number;
    disabledUsers: number;
  } {
    let totalViolations = 0;
    let disabledUsers = 0;

    for (const violations of this.violationHistory.values()) {
      totalViolations += violations.length;
      if (violations.length >= this.MAX_VIOLATIONS) {
        disabledUsers++;
      }
    }

    return {
      totalViolations,
      usersWithViolations: this.violationHistory.size,
      disabledUsers
    };
  }
}

export default SecurityService;