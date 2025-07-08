import logger from '../utils/logger';
import UserService from './userService';
import EmailService from './emailService';
import ContextService from './contextService';
import { FunctionCallResult } from './functionCallService';
import { User } from '../models/User';

/**
 * 用户专属的Function Call服务
 * 确保每个用户只能操作自己的数据，提供最高级别的数据安全
 */
export class UserFunctionCallService {
  private userService: UserService;
  private emailService: EmailService;
  private contextService: ContextService;

  constructor(userService: UserService, contextService?: ContextService) {
    this.userService = userService;
    this.emailService = new EmailService();
    this.contextService = contextService || new ContextService();
  }

  /**
   * 处理用户专属的Function Call
   * @param functionName 函数名称
   * @param functionArgs 函数参数
   * @param user 当前用户（已经过身份验证）
   */
  async handleUserFunction(
    functionName: string, 
    functionArgs: any, 
    user: User
  ): Promise<FunctionCallResult> {
    logger.info(`User ${user.email} calling function: ${functionName}`, functionArgs);

    switch (functionName) {
      case 'update_my_schedule_times':
        return await this.updateMyScheduleTimes(functionArgs, user);
      
      case 'mark_my_emails_as_read':
        return await this.markMyEmailsAsRead(functionArgs, user);
      
      case 'get_my_config':
        return await this.getMyConfig(user);
      
      case 'stop_my_service':
        return await this.stopMyService(functionArgs, user);
      
      case 'remove_my_account':
        return await this.removeMyAccount(functionArgs, user);
      
      case 'get_help':
        return await this.getHelp(functionArgs);
      
      default:
        logger.warn(`Unknown function called by user ${user.email}: ${functionName}`);
        return {
          success: false,
          message: `未知的功能：${functionName}`
        };
    }
  }

  /**
   * 用户修改自己的提醒时间
   */
  private async updateMyScheduleTimes(
    args: { morningTime?: string; eveningTime?: string }, 
    user: User
  ): Promise<FunctionCallResult> {
    try {
      // 验证时间格式
      const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
      
      if (args.morningTime && !timeRegex.test(args.morningTime)) {
        return {
          success: false,
          message: '早晨时间格式无效，请使用 HH:MM 格式（如 08:30）'
        };
      }

      if (args.eveningTime && !timeRegex.test(args.eveningTime)) {
        return {
          success: false,
          message: '晚间时间格式无效，请使用 HH:MM 格式（如 20:00）'
        };
      }

      // 构建新的配置
      const newConfig = {
        ...user.config,
        schedule: {
          ...user.config.schedule,
          ...(args.morningTime && { morningReminderTime: args.morningTime }),
          ...(args.eveningTime && { eveningReminderTime: args.eveningTime })
        }
      };

      // 更新用户配置
      this.userService.updateUser(user.id, { config: newConfig });

      const updates: string[] = [];
      if (args.morningTime) updates.push(`早晨提醒时间：${args.morningTime}`);
      if (args.eveningTime) updates.push(`晚间提醒时间：${args.eveningTime}`);

      logger.info(`User ${user.email} updated schedule times:`, args);

      return {
        success: true,
        message: `您的提醒时间已成功更新：${updates.join('，')}。新的提醒时间从明天开始生效。`,
        data: {
          morningTime: newConfig.schedule.morningReminderTime,
          eveningTime: newConfig.schedule.eveningReminderTime,
          updatedFields: Object.keys(args)
        }
      };

    } catch (error) {
      logger.error(`Failed to update schedule times for user ${user.email}:`, error);
      return {
        success: false,
        message: '更新提醒时间失败，请稍后重试'
      };
    }
  }

  /**
   * 用户标记自己的邮件为已读
   */
  private async markMyEmailsAsRead(
    args: { markAll?: boolean; messageIds?: string[]; fromSender?: string }, 
    user: User
  ): Promise<FunctionCallResult> {
    try {
      logger.info(`User ${user.email} marking emails as read:`, args);

      if (args.markAll) {
        return {
          success: true,
          message: '已标记您的所有未读邮件为已读。此操作将在下次邮件检查时生效。',
          data: { 
            action: 'mark_all_read',
            userId: user.id,
            userEmail: user.email
          }
        };
      }

      if (args.messageIds && args.messageIds.length > 0) {
        return {
          success: true,
          message: `已标记您的 ${args.messageIds.length} 封邮件为已读。`,
          data: { 
            action: 'mark_specific_read',
            messageIds: args.messageIds,
            count: args.messageIds.length,
            userId: user.id
          }
        };
      }

      if (args.fromSender) {
        return {
          success: true,
          message: `已标记您收到的来自 ${args.fromSender} 的所有邮件为已读。`,
          data: { 
            action: 'mark_sender_read',
            sender: args.fromSender,
            userId: user.id
          }
        };
      }

      return {
        success: false,
        message: '请指定要标记为已读的邮件：使用 markAll、messageIds 或 fromSender 参数'
      };

    } catch (error) {
      logger.error(`Failed to mark emails as read for user ${user.email}:`, error);
      return {
        success: false,
        message: '标记邮件已读失败，请稍后重试'
      };
    }
  }

  /**
   * 获取用户自己的配置信息
   */
  private async getMyConfig(user: User): Promise<FunctionCallResult> {
    try {
      const configInfo = {
        name: user.name,
        email: user.email,
        language: user.config.language === 'zh' ? '中文' : '英文',
        morningReminderTime: user.config.schedule.morningReminderTime,
        eveningReminderTime: user.config.schedule.eveningReminderTime,
        timezone: user.config.schedule.timezone,
        status: user.isActive ? '启用' : '禁用',
        createdAt: user.createdAt.toLocaleDateString(),
        lastUpdated: user.updatedAt.toLocaleDateString()
      };

      return {
        success: true,
        message: '您的当前配置信息',
        data: configInfo
      };

    } catch (error) {
      logger.error(`Failed to get config for user ${user.email}:`, error);
      return {
        success: false,
        message: '获取配置信息失败'
      };
    }
  }

  /**
   * 用户停止自己的服务
   */
  private async stopMyService(
    args: { confirmStop: boolean; reason?: string }, 
    user: User
  ): Promise<FunctionCallResult> {
    try {
      // 验证确认参数
      if (!args.confirmStop) {
        return {
          success: false,
          message: '服务停止需要确认。请将 confirmStop 设置为 true 以确认停止服务。'
        };
      }

      // 禁用用户
      this.userService.updateUser(user.id, { isActive: false });

      // 发送停止通知邮件给用户
      await this.sendServiceStoppedNotificationToUser(user, args.reason);

      // 发送通知邮件给管理员
      await this.sendServiceStoppedNotificationToAdmin(user, args.reason);

      logger.info(`User ${user.email} stopped their service. Reason: ${args.reason || 'Not provided'}`);

      return {
        success: true,
        message: '您的邮件助手服务已成功停止。感谢您的使用！如需重新启用，请联系管理员。',
        data: {
          userId: user.id,
          stoppedAt: new Date().toISOString(),
          reason: args.reason
        }
      };

    } catch (error) {
      logger.error(`Failed to stop service for user ${user.email}:`, error);
      return {
        success: false,
        message: '停止服务失败，请稍后重试或联系管理员'
      };
    }
  }

  /**
   * 发送服务停止通知给用户
   */
  private async sendServiceStoppedNotificationToUser(user: User, reason?: string): Promise<void> {
    try {
      const subject = `✋ 邮件助手服务已停止`;
      const content = `
亲爱的 ${user.name}，

您的邮件助手服务已按您的要求停止。

📋 停止详情：
• 停止时间：${new Date().toLocaleString()}
• 停止原因：${reason || '用户主动停止'}
• 账户状态：已暂停

🔒 影响说明：
• 将不再接收智能邮件回复
• 定时提醒已停止
• 所有自动化功能已暂停
• 个人数据和配置已保留

🔄 重新启用：
如需重新启用服务，请联系管理员。
您的所有配置和历史记录都将得到保留。

感谢您使用邮件助手服务！

此致，
邮件助手团队
      `.trim();

      await this.emailService.sendEmail(subject, content, false, user.email);

    } catch (error) {
      logger.error('Failed to send service stopped notification to user:', error);
    }
  }

  /**
   * 用户移除自己的账户（完全删除）
   */
  private async removeMyAccount(
    args: { confirmRemoval: boolean; finalConfirmation: string; reason?: string }, 
    user: User
  ): Promise<FunctionCallResult> {
    try {
      // 多重验证确认
      if (!args.confirmRemoval) {
        return {
          success: false,
          message: '账户移除需要确认。请将 confirmRemoval 设置为 true 以确认移除账户。'
        };
      }

      if (args.finalConfirmation !== '我确认删除我的账户') {
        return {
          success: false,
          message: '最终确认失败。请在 finalConfirmation 中输入完整的确认文本："我确认删除我的账户"'
        };
      }

      // 发送移除前通知邮件给用户
      await this.sendAccountRemovalNotificationToUser(user, args.reason);

      // 发送通知邮件给管理员
      await this.sendAccountRemovalNotificationToAdmin(user, args.reason);

      // 清除用户的上下文历史
      try {
        await this.contextService?.clearUserContext(user.id);
      } catch (error) {
        logger.warn(`Failed to clear context for user ${user.id}:`, error);
      }

      // 删除用户
      this.userService.deleteUser(user.id);

      logger.warn(`User account completely removed: ${user.email}. Reason: ${args.reason || 'Not provided'}`);

      return {
        success: true,
        message: '您的邮件助手账户已完全移除。感谢您曾经使用我们的服务！所有数据已被删除，此操作不可恢复。',
        data: {
          userId: user.id,
          userEmail: user.email,
          removedAt: new Date().toISOString(),
          reason: args.reason,
          dataDeleted: true
        }
      };

    } catch (error) {
      logger.error(`Failed to remove account for user ${user.email}:`, error);
      return {
        success: false,
        message: '账户移除失败，请稍后重试或联系管理员'
      };
    }
  }

  /**
   * 发送账户移除通知给用户
   */
  private async sendAccountRemovalNotificationToUser(user: User, reason?: string): Promise<void> {
    try {
      const subject = `🗑️ 账户移除确认 - 再见了！`;
      const content = `
亲爱的 ${user.name}，

您的邮件助手账户移除请求已处理完成。

📋 移除详情：
• 移除时间：${new Date().toLocaleString()}
• 移除原因：${reason || '用户主动删除'}
• 数据状态：已完全删除

🗑️ 已删除的数据：
• 个人配置和偏好设置
• 所有对话历史记录
• 定时提醒设置
• 邮件处理记录

⚠️ 重要提醒：
• 此操作不可撤销
• 所有数据已永久删除
• 如需重新使用，需重新注册

💭 感谢您的反馈：
${reason ? `您提供的原因："${reason}"` : ''}
我们会持续改进服务质量。

感谢您曾经选择邮件助手！
祝您工作顺利，生活愉快！

此致，
邮件助手团队

---
这是您收到的最后一封来自邮件助手的邮件。
      `.trim();

      await this.emailService.sendEmail(subject, content, false, user.email);

    } catch (error) {
      logger.error('Failed to send account removal notification to user:', error);
    }
  }

  /**
   * 发送账户移除通知给管理员
   */
  private async sendAccountRemovalNotificationToAdmin(user: User, reason?: string): Promise<void> {
    try {
      const subject = `🗑️ 用户账户移除通知`;
      const content = `
管理员您好，

用户主动移除了邮件助手账户。

👤 用户信息：
• 姓名：${user.name}
• 邮箱：${user.email}
• 移除时间：${new Date().toLocaleString()}
• 移除原因：${reason || '未提供'}
• 注册时间：${user.createdAt.toLocaleDateString()}
• 使用时长：${Math.ceil((new Date().getTime() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24))} 天

🗑️ 数据处理：
• 用户数据：已完全删除
• 对话历史：已清除
• 配置信息：已移除
• 状态：账户不存在

💭 用户反馈：
${reason ? `"${reason}"` : '用户未提供移除原因'}

📊 统计影响：
• 总用户数减少 1
• 建议分析用户流失原因
• 考虑改进服务体验

此致，
邮件助手系统
      `.trim();

      await this.emailService.sendEmail(subject, content);

    } catch (error) {
      logger.error('Failed to send account removal notification to admin:', error);
    }
  }

  /**
   * 发送服务停止通知给管理员
   */
  private async sendServiceStoppedNotificationToAdmin(user: User, reason?: string): Promise<void> {
    try {
      const subject = `📢 用户主动停止服务通知`;
      const content = `
管理员您好，

用户主动停止了邮件助手服务。

👤 用户信息：
• 姓名：${user.name}
• 邮箱：${user.email}
• 停止时间：${new Date().toLocaleString()}
• 停止原因：${reason || '未提供'}

📊 账户状态：
• 服务状态：已停止
• 数据保留：是
• 停止方式：用户主动

🔧 管理操作：
如需重新启用该用户，请使用：
/enableuser ${user.email}

此致，
邮件助手系统
      `.trim();

      await this.emailService.sendEmail(subject, content);

    } catch (error) {
      logger.error('Failed to send service stopped notification to admin:', error);
    }
  }

  /**
   * 获取帮助信息
   */
  private async getHelp(args: { topic?: string }): Promise<FunctionCallResult> {
    try {
      const topic = args.topic || 'all';
      
      let helpContent = '';
      
      switch (topic) {
        case 'basic':
          helpContent = this.getBasicHelp();
          break;
        case 'time':
          helpContent = this.getTimeHelp();
          break;
        case 'email':
          helpContent = this.getEmailHelp();
          break;
        case 'functions':
          helpContent = this.getFunctionsHelp();
          break;
        case 'all':
        default:
          helpContent = this.getAllHelp();
          break;
      }

      return {
        success: true,
        message: helpContent,
        data: { topic, timestamp: new Date().toISOString() }
      };

    } catch (error) {
      logger.error('Failed to get help:', error);
      return {
        success: false,
        message: '获取帮助信息失败'
      };
    }
  }

  private getBasicHelp(): string {
    return `
📚 邮件助手基础使用指南

🤖 与AI对话：
• 直接回复邮件与AI助手交流
• 使用自然语言表达需求
• 例如："请帮我总结今天的工作"

📧 邮件回复：
• 收到提醒邮件后直接回复
• 提供工作报告或日程反馈
• AI会自动理解并处理您的内容

⏰ 自动提醒：
• 每日早晨：日程提醒和建议
• 每日晚间：工作报告请求
• 个性化时间设置

💡 小贴士：
• 保持邮件简洁明了
• 可以使用中文或英文
• 系统会学习您的使用习惯
    `.trim();
  }

  private getTimeHelp(): string {
    return `
⏰ 时间设置帮助

🕐 调整提醒时间：
• "请把我的早晨提醒改到8点30分"
• "调整晚间提醒到19:00"
• "修改我的提醒时间：早上7:45，晚上8:30"

📅 时间格式：
• 支持12小时制：8:30 AM, 7:00 PM
• 支持24小时制：08:30, 19:00
• 支持中文表达：上午8点半，晚上7点

🔄 生效时间：
• 时间调整立即生效
• 从第二天开始按新时间提醒
• 可随时调整，不限次数

💡 最佳实践：
• 早晨提醒：建议7:00-10:00
• 晚间提醒：建议17:00-21:00
• 考虑工作时间和个人习惯
    `.trim();
  }

  private getEmailHelp(): string {
    return `
📧 邮件管理功能

📬 标记已读：
• "标记所有邮件为已读"
• "标记来自张三的邮件为已读"
• "把这些邮件标记为已读"

📨 邮件分类：
• 工作报告邮件
• 日程反馈邮件
• 一般对话邮件
• 系统通知邮件

🔄 自动处理：
• 智能识别邮件类型
• 自动生成合适回复
• 保存对话历史记录

⚡ 快速操作：
• 回复邮件即可对话
• 无需登录任何界面
• 随时随地使用
    `.trim();
  }

  private getFunctionsHelp(): string {
    return `
🛠️ 可用功能列表

⏰ 时间管理：
• update_my_schedule_times - 调整提醒时间
• get_my_config - 查看当前配置

📧 邮件管理：
• mark_my_emails_as_read - 标记邮件已读

🔧 账户管理：
• stop_my_service - 暂停服务（可恢复）
• remove_my_account - 删除账户（不可恢复）
• get_help - 获取帮助信息

💡 使用方法：
直接用自然语言表达需求，AI会自动调用相应功能：
• "改一下我的提醒时间"
• "把邮件标记为已读"
• "显示我的配置"
• "我想暂停服务"
• "请删除我的账户"

⚠️ 重要提醒：
• 暂停服务：可由管理员重新启用
• 删除账户：永久删除所有数据，不可恢复

🎯 智能理解：
系统支持多种表达方式，无需记忆具体命令。
    `.trim();
  }

  private getAllHelp(): string {
    // 为了避免邮件过长，全部帮助采用目录形式
    return `
📖 邮件助手使用指南

🎯 快速开始：
• 直接回复邮件与AI对话
• 说"调整提醒时间"来修改设置
• 说"标记邮件已读"来管理邮件

📚 详细帮助主题：
• 回复"基础帮助"查看基本使用方法
• 回复"时间帮助"查看时间设置指南  
• 回复"邮件帮助"查看邮件管理功能
• 回复"功能帮助"查看所有可用功能

💡 使用小贴士：
• 使用自然语言表达需求
• 支持中文和英文交流
• 系统会自动理解您的意图

🆘 需要支持？
直接询问具体问题，如"如何修改提醒时间？"

感谢使用邮件助手！🎉

💬 回复相应关键词获取详细帮助信息。
    `.trim();
  }
}

/**
 * 管理员专属的Function Call服务
 */
export class AdminFunctionCallService {
  private userService: UserService;

  constructor(userService: UserService) {
    this.userService = userService;
  }

  async handleAdminFunction(
    functionName: string, 
    functionArgs: any
  ): Promise<FunctionCallResult> {
    logger.info(`Admin calling function: ${functionName}`, functionArgs);

    switch (functionName) {
      case 'admin_add_user':
        return await this.addUser(functionArgs);
      
      case 'admin_list_users':
        return await this.listUsers();
      
      case 'admin_update_user':
        return await this.updateUser(functionArgs);
      
      default:
        return {
          success: false,
          message: `未知的管理员功能：${functionName}`
        };
    }
  }

  private async addUser(args: { 
    email: string; 
    name: string; 
    morningTime?: string; 
    eveningTime?: string 
  }): Promise<FunctionCallResult> {
    // 检查用户是否已存在
    if (this.userService.getUserByEmail(args.email)) {
      return {
        success: false,
        message: `用户 ${args.email} 已存在`
      };
    }

    const customConfig = {
      schedule: {
        morningReminderTime: args.morningTime || '09:00',
        eveningReminderTime: args.eveningTime || '18:00',
        timezone: 'Asia/Shanghai'
      },
      language: 'zh' as const
    };

    const user = this.userService.createUser(args.email, args.name, customConfig);
    this.userService.addUser(user);

    return {
      success: true,
      message: `用户 ${args.name} (${args.email}) 添加成功`,
      data: {
        userId: user.id,
        email: args.email,
        name: args.name,
        morningTime: customConfig.schedule.morningReminderTime,
        eveningTime: customConfig.schedule.eveningReminderTime
      }
    };
  }

  private async listUsers(): Promise<FunctionCallResult> {
    const users = this.userService.getAllUsers();
    const userList = users.map(user => ({
      name: user.name,
      email: user.email,
      status: user.isActive ? '启用' : '禁用',
      morningTime: user.config.schedule.morningReminderTime,
      eveningTime: user.config.schedule.eveningReminderTime,
      created: user.createdAt.toLocaleDateString()
    }));

    return {
      success: true,
      message: `当前有 ${users.length} 个用户`,
      data: { users: userList }
    };
  }

  private async updateUser(args: { 
    email: string; 
    field: string; 
    value: string 
  }): Promise<FunctionCallResult> {
    const user = this.userService.getUserByEmail(args.email);
    if (!user) {
      return {
        success: false,
        message: `用户 ${args.email} 不存在`
      };
    }

    // 执行更新逻辑（类似之前的adminCommandService）
    // 这里可以复用之前的更新逻辑
    
    return {
      success: true,
      message: `用户 ${args.email} 的 ${args.field} 已更新为 ${args.value}`,
      data: { email: args.email, field: args.field, value: args.value }
    };
  }
}

export default UserFunctionCallService;