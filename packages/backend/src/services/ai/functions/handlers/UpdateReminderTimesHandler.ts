import { BaseFunctionHandler } from '../../core/base/BaseFunctionHandler';
import { FunctionResult, FunctionDefinition } from '../../core/interfaces/IFunctionHandler';
import UserService from '../../../user/userService';
import logger from '../../../../utils/logger';

export class UpdateReminderTimesHandler extends BaseFunctionHandler {
  readonly name = 'update_reminder_times';
  readonly definition: FunctionDefinition = {
    name: 'update_reminder_times',
    description: '更新用户的提醒时间设置',
    parameters: {
      type: 'object',
      properties: {
        morningHour: {
          type: 'number',
          description: '早晨提醒小时数 (0-23)'
        },
        morningMinute: {
          type: 'number',
          description: '早晨提醒分钟数 (0-59)'
        },
        eveningHour: {
          type: 'number',
          description: '晚间提醒小时数 (0-23)'
        },
        eveningMinute: {
          type: 'number',
          description: '晚间提醒分钟数 (0-59)'
        }
      }
    }
  };

  private userService: UserService;

  constructor(userService?: UserService) {
    super();
    this.userService = userService || new UserService();
  }

  async handle(args: Record<string, unknown>, userId?: string): Promise<FunctionResult> {
    try {
      if (!userId) {
        return this.createErrorResult('需要用户身份验证才能修改提醒时间');
      }

      const user = this.userService.getUserById(userId);
      if (!user) {
        return this.createErrorResult('用户未找到');
      }

      // 获取和验证数字参数
      const morningHour = args.morningHour as number | undefined;
      const morningMinute = args.morningMinute as number | undefined;
      const eveningHour = args.eveningHour as number | undefined;
      const eveningMinute = args.eveningMinute as number | undefined;
      
      let morningTime: string | undefined;
      let eveningTime: string | undefined;
      
      // 验证和构建早晨时间
      if (morningHour !== undefined || morningMinute !== undefined) {
        if (morningHour === undefined || morningMinute === undefined) {
          return this.createErrorResult('早晨时间需要同时提供小时和分钟');
        }
        
        if (!this.isValidTime(morningHour, morningMinute)) {
          return this.createErrorResult(`早晨时间无效：${morningHour}:${morningMinute}。小时应在0-23之间，分钟应在0-59之间`);
        }
        
        morningTime = `${morningHour.toString().padStart(2, '0')}:${morningMinute.toString().padStart(2, '0')}`;
      }
      
      // 验证和构建晚间时间
      if (eveningHour !== undefined || eveningMinute !== undefined) {
        if (eveningHour === undefined || eveningMinute === undefined) {
          return this.createErrorResult('晚间时间需要同时提供小时和分钟');
        }
        
        if (!this.isValidTime(eveningHour, eveningMinute)) {
          return this.createErrorResult(`晚间时间无效：${eveningHour}:${eveningMinute}。小时应在0-23之间，分钟应在0-59之间`);
        }
        
        eveningTime = `${eveningHour.toString().padStart(2, '0')}:${eveningMinute.toString().padStart(2, '0')}`;
      }

      // 更新用户配置
      const newConfig = {
        ...user.config,
        schedule: {
          ...user.config.schedule,
          ...(morningTime && { morningReminderTime: morningTime }),
          ...(eveningTime && { eveningReminderTime: eveningTime })
        }
      };

      this.userService.updateUser(userId, { config: newConfig });

      const updateMessages: string[] = [];
      if (morningTime) {
        updateMessages.push(`早晨提醒时间已更新为 ${morningTime}`);
      }
      if (eveningTime) {
        updateMessages.push(`晚间提醒时间已更新为 ${eveningTime}`);
      }
      const updateMessage = updateMessages.join('，');

      return this.createSuccessResult(
        `提醒时间设置成功！${updateMessage}`,
        {
          userId,
          morningTime: newConfig.schedule.morningReminderTime,
          eveningTime: newConfig.schedule.eveningReminderTime
        }
      );

    } catch (error) {
      logger.error('Failed to update reminder times:', error);
      return this.createErrorResult('更新提醒时间失败，请稍后重试');
    }
  }

  /**
   * 验证时间数字是否有效
   */
  private isValidTime(hour: number, minute: number): boolean {
    return (
      Number.isInteger(hour) &&
      Number.isInteger(minute) &&
      hour >= 0 && hour <= 23 &&
      minute >= 0 && minute <= 59
    );
  }
}