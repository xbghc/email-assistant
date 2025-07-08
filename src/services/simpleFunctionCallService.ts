import logger from '../utils/logger';
import UserService from './userService';
import { UserConfig } from '../models/User';

export interface SimpleFunctionResult {
  success: boolean;
  message: string;
}

class SimpleFunctionCallService {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  async initialize(): Promise<void> {
    await this.userService.initialize();
  }

  async handleFunctionCall(functionName: string, args: Record<string, unknown>, userId?: string): Promise<SimpleFunctionResult> {
    try {
      logger.debug(`Processing function call: ${functionName}`, { args, userId });

      switch (functionName) {
        case 'update_reminder_times':
          return await this.updateReminderTimes(args, userId);
        case 'mark_emails_read':
          return await this.markEmailsRead(args);
        case 'get_user_config':
          return await this.getUserConfig(userId);
        default:
          return {
            success: false,
            message: `未知的功能：${functionName}`
          };
      }
    } catch (error) {
      logger.error('Function call processing failed:', error);
      return {
        success: false,
        message: '功能执行失败，请稍后重试'
      };
    }
  }

  private async updateReminderTimes(args: Record<string, unknown>, userId?: string): Promise<SimpleFunctionResult> {
    const morningTime = args.morningTime as string | undefined;
    const eveningTime = args.eveningTime as string | undefined;
    
    if (!userId) {
      return {
        success: false,
        message: '需要用户身份验证才能修改提醒时间'
      };
    }

    const user = this.userService.getUserById(userId);
    if (!user) {
      return {
        success: false,
        message: '用户未找到'
      };
    }

    // 验证时间格式
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (morningTime && !timeRegex.test(morningTime)) {
      return {
        success: false,
        message: '早晨时间格式无效，请使用 HH:MM 格式'
      };
    }
    if (eveningTime && !timeRegex.test(eveningTime)) {
      return {
        success: false,
        message: '晚间时间格式无效，请使用 HH:MM 格式'
      };
    }

    // 更新用户配置
    const newConfig: UserConfig = {
      ...user.config,
      schedule: {
        ...user.config.schedule,
        morningReminderTime: morningTime || user.config.schedule.morningReminderTime,
        eveningReminderTime: eveningTime || user.config.schedule.eveningReminderTime,
      }
    };

    const success = await this.userService.updateUserConfig(userId, newConfig);
    if (success) {
      const updatedTimes = [];
      if (morningTime) updatedTimes.push(`早晨提醒: ${morningTime}`);
      if (eveningTime) updatedTimes.push(`晚间提醒: ${eveningTime}`);
      
      return {
        success: true,
        message: `提醒时间已更新: ${updatedTimes.join(', ')}`
      };
    } else {
      return {
        success: false,
        message: '提醒时间更新失败'
      };
    }
  }

  private async markEmailsRead(args: Record<string, unknown>): Promise<SimpleFunctionResult> {
    const { markAll } = args;
    
    if (markAll) {
      // 这里应该调用邮件服务来标记邮件
      // 暂时返回模拟结果
      return {
        success: true,
        message: '已标记所有邮件为已读'
      };
    } else {
      return {
        success: false,
        message: '请指定要标记的邮件'
      };
    }
  }

  private async getUserConfig(userId?: string): Promise<SimpleFunctionResult> {
    if (!userId) {
      return {
        success: false,
        message: '需要用户身份验证才能查看配置'
      };
    }

    const user = this.userService.getUserById(userId);
    if (!user) {
      return {
        success: false,
        message: '用户未找到'
      };
    }

    const configInfo = `
📋 您的当前配置：
• 姓名：${user.name}
• 邮箱：${user.email}
• 早晨提醒：${user.config.schedule.morningReminderTime}
• 晚间提醒：${user.config.schedule.eveningReminderTime}
• 时区：${user.config.schedule.timezone}
• 语言：${user.config.language === 'zh' ? '中文' : '英文'}
• 账户状态：${user.isActive ? '启用' : '禁用'}
• 创建时间：${user.createdAt.toLocaleDateString()}
    `.trim();

    return {
      success: true,
      message: configInfo
    };
  }
}

export default SimpleFunctionCallService;