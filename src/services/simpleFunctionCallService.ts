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

    // 解析和验证时间格式
    const originalMorningTime = args.morningTime as string | undefined;
    const originalEveningTime = args.eveningTime as string | undefined;
    
    let morningTime: string | undefined;
    let eveningTime: string | undefined;
    
    // 解析早晨时间
    if (originalMorningTime) {
      morningTime = this.parseTimeString(originalMorningTime);
      if (!morningTime) {
        return {
          success: false,
          message: `早晨时间格式无效："${originalMorningTime}"，请使用 HH:MM 格式（如：09:30）或自然语言（如：9点半）`
        };
      }
    }
    
    // 解析晚间时间
    if (originalEveningTime) {
      eveningTime = this.parseTimeString(originalEveningTime);
      if (!eveningTime) {
        return {
          success: false,
          message: `晚间时间格式无效："${originalEveningTime}"，请使用 HH:MM 格式（如：18:30）或自然语言（如：6点半）`
        };
      }
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

  /**
   * 解析时间字符串，支持自然语言格式
   */
  private parseTimeString(timeInput: string | undefined): string | undefined {
    if (!timeInput) return undefined;
    
    const input = timeInput.trim();
    
    // 如果已经是HH:MM格式，直接返回
    if (/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(input)) {
      return input;
    }
    
    // 解析自然语言时间
    const patterns = [
      // 9点半 -> 09:30
      { pattern: /(\d{1,2})点半/, replacement: (match: string, hour: string) => {
        const h = parseInt(hour);
        return h < 10 ? `0${h}:30` : `${h}:30`;
      }},
      // 9点 -> 09:00
      { pattern: /(\d{1,2})点/, replacement: (match: string, hour: string) => {
        const h = parseInt(hour);
        return h < 10 ? `0${h}:00` : `${h}:00`;
      }},
      // 9:30 -> 09:30
      { pattern: /^(\d{1,2}):(\d{2})$/, replacement: (match: string, hour: string, minute: string) => {
        const h = parseInt(hour);
        return h < 10 ? `0${h}:${minute}` : `${h}:${minute}`;
      }},
      // 930 -> 09:30
      { pattern: /^(\d{1,2})(\d{2})$/, replacement: (match: string, hour: string, minute: string) => {
        const h = parseInt(hour);
        return h < 10 ? `0${h}:${minute}` : `${h}:${minute}`;
      }}
    ];
    
    for (const { pattern, replacement } of patterns) {
      const match = input.match(pattern);
      if (match) {
        const result = replacement(match[0], match[1] || '', match[2] || '');
        // 验证结果格式
        if (/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(result)) {
          return result;
        }
      }
    }
    
    logger.warn(`Unable to parse time string: ${input}`);
    return undefined;
  }
}

export default SimpleFunctionCallService;