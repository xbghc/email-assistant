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
        morningTime: {
          type: 'string',
          description: '早晨提醒时间，格式为 HH:MM 或自然语言（如：9点半）'
        },
        eveningTime: {
          type: 'string',
          description: '晚间提醒时间，格式为 HH:MM 或自然语言（如：6点）'
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

      // 解析和验证时间格式
      const originalMorningTime = args.morningTime as string | undefined;
      const originalEveningTime = args.eveningTime as string | undefined;
      
      let morningTime: string | undefined;
      let eveningTime: string | undefined;
      
      // 解析早晨时间
      if (originalMorningTime) {
        morningTime = this.parseTimeString(originalMorningTime) || undefined;
        if (!morningTime) {
          return this.createErrorResult(
            `早晨时间格式无效："${originalMorningTime}"，请使用 HH:MM 格式（如：09:30）或自然语言（如：9点半）`
          );
        }
      }
      
      // 解析晚间时间
      if (originalEveningTime) {
        eveningTime = this.parseTimeString(originalEveningTime) || undefined;
        if (!eveningTime) {
          return this.createErrorResult(
            `晚间时间格式无效："${originalEveningTime}"，请使用 HH:MM 格式（如：18:00）或自然语言（如：6点）`
          );
        }
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

  private parseTimeString(timeStr: string): string | null {
    // 清理输入
    const cleanTime = timeStr.trim().toLowerCase();
    
    // 直接匹配 HH:MM 格式
    const directMatch = cleanTime.match(/^([01]?[0-9]|2[0-3]):([0-5][0-9])$/);
    if (directMatch) {
      return directMatch[0];
    }
    
    // 匹配自然语言时间表达
    const patterns = [
      // X点 或 X点钟
      { regex: /(\d{1,2})点钟?$/, handler: (match: RegExpMatchArray) => `${(match[1] || '0').padStart(2, '0')}:00` },
      // X点半
      { regex: /(\d{1,2})点半$/, handler: (match: RegExpMatchArray) => `${(match[1] || '0').padStart(2, '0')}:30` },
      // X点Y分
      { regex: /(\d{1,2})点(\d{1,2})分?$/, handler: (match: RegExpMatchArray) => 
        `${(match[1] || '0').padStart(2, '0')}:${(match[2] || '0').padStart(2, '0')}` },
      // 上午/下午 X点
      { regex: /([上下])午(\d{1,2})点钟?$/, handler: (match: RegExpMatchArray) => {
        let hour = parseInt(match[2] || '0');
        if ((match[1] || '') === '下' && hour < 12) hour += 12;
        if ((match[1] || '') === '上' && hour === 12) hour = 0;
        return `${hour.toString().padStart(2, '0')}:00`;
      }},
      // 早上/晚上 X点
      { regex: /(早上|晚上)(\d{1,2})点钟?$/, handler: (match: RegExpMatchArray) => {
        let hour = parseInt(match[2] || '0');
        if ((match[1] || '') === '晚上' && hour < 12) hour += 12;
        return `${hour.toString().padStart(2, '0')}:00`;
      }}
    ];
    
    for (const pattern of patterns) {
      const match = cleanTime.match(pattern.regex);
      if (match) {
        const result = pattern.handler(match);
        // 验证生成的时间格式
        if (/^([01]?[0-9]|2[0-3]):([0-5][0-9])$/.test(result)) {
          return result;
        }
      }
    }
    
    return null;
  }
}