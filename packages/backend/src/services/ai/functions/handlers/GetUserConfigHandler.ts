import { BaseFunctionHandler } from '../../core/base/BaseFunctionHandler';
import { FunctionResult, FunctionDefinition } from '../../core/interfaces/IFunctionHandler';
import UserService from '../../../user/userService';
import config from '../../../../config/index';
import logger from '../../../../utils/logger';

export class GetUserConfigHandler extends BaseFunctionHandler {
  readonly name = 'get_user_config';
  readonly definition: FunctionDefinition = {
    name: 'get_user_config',
    description: '获取用户当前配置信息',
    parameters: {
      type: 'object',
      properties: {}
    }
  };

  private userService: UserService;

  constructor(userService?: UserService) {
    super();
    this.userService = userService || new UserService();
  }

  async handle(_args: Record<string, unknown>, userId?: string): Promise<FunctionResult> {
    try {
      if (!userId) {
        // 返回系统默认配置
        const systemConfig = {
          morningReminderTime: config.schedule.morningReminderTime,
          eveningReminderTime: config.schedule.eveningReminderTime,
          emailCheckInterval: config.email.imap.checkIntervalMs,
          forwardingEnabled: config.email.forwarding.enabled,
          aiProvider: config.ai.provider,
          userType: 'guest'
        };

        return this.createSuccessResult(
          '系统默认配置信息',
          systemConfig
        );
      }

      const user = this.userService.getUserById(userId);
      if (!user) {
        return this.createErrorResult('用户未找到');
      }

      const userConfig = {
        morningReminderTime: user.config.schedule.morningReminderTime,
        eveningReminderTime: user.config.schedule.eveningReminderTime,
        language: user.config.language,
        reminderPaused: user.config.reminderPaused || false,
        aiProvider: config.ai.provider,
        userRole: user.role,
        userName: user.name,
        userEmail: user.email,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt
      };

      return this.createSuccessResult(
        '用户配置信息',
        userConfig
      );

    } catch (error) {
      logger.error('Failed to get user config:', error);
      return this.createErrorResult('获取配置信息失败');
    }
  }
}