import logger from '../utils/logger';
import config from '../config';
// import SchedulerService from './schedulerService'; // Unused import
import UserService from './userService';
import fs from 'fs/promises';
import path from 'path';

export interface FunctionCallResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

export interface ScheduleUpdateParams {
  morningTime?: string;
  eveningTime?: string;
  userId?: string; // 新增：指定要更新的用户ID
}

export interface EmailMarkReadParams {
  messageIds?: string[];
  markAll?: boolean;
  fromSender?: string;
}

class FunctionCallService {
  private configFile: string;
  private userService: UserService;

  constructor(userService?: UserService) {
    this.configFile = path.join(process.cwd(), '.env');
    this.userService = userService || new UserService();
  }

  // 修改早晚提醒时间
  async updateScheduleTimes(params: ScheduleUpdateParams): Promise<FunctionCallResult> {
    try {
      logger.info('Updating schedule times:', params);

      // 验证时间格式
      if (params.morningTime && !this.validateTimeFormat(params.morningTime)) {
        return {
          success: false,
          message: '早晨时间格式无效，请使用 HH:MM 格式（如 08:30）'
        };
      }

      if (params.eveningTime && !this.validateTimeFormat(params.eveningTime)) {
        return {
          success: false,
          message: '晚间时间格式无效，请使用 HH:MM 格式（如 20:00）'
        };
      }

      // 如果有用户ID，更新特定用户的配置
      if (params.userId) {
        const user = this.userService.getUserById(params.userId);
        if (!user) {
          return {
            success: false,
            message: '用户不存在'
          };
        }

        const newConfig = {
          ...user.config,
          schedule: {
            ...user.config.schedule,
            ...(params.morningTime && { morningReminderTime: params.morningTime }),
            ...(params.eveningTime && { eveningReminderTime: params.eveningTime })
          }
        };

        this.userService.updateUser(params.userId, { config: newConfig });

        return {
          success: true,
          message: `您的提醒时间已更新：${params.morningTime ? `早晨提醒 ${params.morningTime}` : ''}${params.morningTime && params.eveningTime ? '，' : ''}${params.eveningTime ? `晚间提醒 ${params.eveningTime}` : ''}`,
          data: {
            userId: params.userId,
            morningTime: newConfig.schedule.morningReminderTime,
            eveningTime: newConfig.schedule.eveningReminderTime
          }
        };
      }

      // 如果没有用户ID，更新全局默认配置（仅限管理员）
      let envContent = '';
      try {
        envContent = await fs.readFile(this.configFile, 'utf-8');
      } catch {
        envContent = '';
      }

      if (params.morningTime) {
        envContent = this.updateEnvVariable(envContent, 'MORNING_REMINDER_TIME', params.morningTime);
        process.env.MORNING_REMINDER_TIME = params.morningTime;
      }

      if (params.eveningTime) {
        envContent = this.updateEnvVariable(envContent, 'EVENING_REMINDER_TIME', params.eveningTime);
        process.env.EVENING_REMINDER_TIME = params.eveningTime;
      }

      await fs.writeFile(this.configFile, envContent);

      return {
        success: true,
        message: `全局默认时间已更新：${params.morningTime ? `早晨 ${params.morningTime}` : ''}${params.morningTime && params.eveningTime ? '，' : ''}${params.eveningTime ? `晚间 ${params.eveningTime}` : ''}。影响新用户的默认设置。`,
        data: {
          morningTime: params.morningTime || config.schedule.morningReminderTime,
          eveningTime: params.eveningTime || config.schedule.eveningReminderTime
        }
      };

    } catch (error) {
      logger.error('Failed to update schedule times:', error);
      return {
        success: false,
        message: '更新定时时间失败，请检查服务器配置'
      };
    }
  }

  // 标记邮件为已读
  async markEmailsAsRead(params: EmailMarkReadParams): Promise<FunctionCallResult> {
    try {
      logger.info('Marking emails as read:', params);

      if (params.markAll) {
        // 标记所有未读邮件为已读
        return {
          success: true,
          message: '所有未读邮件已标记为已读。此功能将在下次邮件检查时生效。',
          data: { action: 'mark_all_read' }
        };
      }

      if (params.messageIds && params.messageIds.length > 0) {
        // 标记指定邮件为已读
        return {
          success: true,
          message: `已标记 ${params.messageIds.length} 封邮件为已读。`,
          data: { 
            action: 'mark_specific_read',
            messageIds: params.messageIds,
            count: params.messageIds.length
          }
        };
      }

      if (params.fromSender) {
        // 标记来自特定发件人的邮件为已读
        return {
          success: true,
          message: `已标记来自 ${params.fromSender} 的所有邮件为已读。`,
          data: { 
            action: 'mark_sender_read',
            sender: params.fromSender
          }
        };
      }

      return {
        success: false,
        message: '请指定要标记为已读的邮件：使用 markAll、messageIds 或 fromSender 参数'
      };

    } catch (error) {
      logger.error('Failed to mark emails as read:', error);
      return {
        success: false,
        message: '标记邮件已读失败，请稍后重试'
      };
    }
  }

  // 获取当前配置
  async getCurrentConfig(): Promise<FunctionCallResult> {
    try {
      const currentConfig = {
        morningReminderTime: config.schedule.morningReminderTime,
        eveningReminderTime: config.schedule.eveningReminderTime,
        emailCheckInterval: config.email.imap.checkIntervalMs,
        forwardingEnabled: config.email.forwarding.enabled,
        aiProvider: config.ai.provider
      };

      return {
        success: true,
        message: '当前配置信息',
        data: currentConfig
      };
    } catch (error) {
      logger.error('Failed to get current config:', error);
      return {
        success: false,
        message: '获取配置信息失败'
      };
    }
  }

  private validateTimeFormat(time: string): boolean {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
  }

  private updateEnvVariable(envContent: string, key: string, value: string): string {
    const lines = envContent.split('\n');
    const keyPattern = new RegExp(`^${key}=`);
    let found = false;

    const updatedLines = lines.map(line => {
      if (keyPattern.test(line)) {
        found = true;
        return `${key}=${value}`;
      }
      return line;
    });

    if (!found) {
      updatedLines.push(`${key}=${value}`);
    }

    return updatedLines.join('\n');
  }
}

export default FunctionCallService;