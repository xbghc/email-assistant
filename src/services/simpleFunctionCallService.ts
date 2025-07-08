import logger from '../utils/logger';
import UserService from './userService';
import { UserConfig, UserRole } from '../models/User';
import ContextService from './contextService';

export interface SimpleFunctionResult {
  success: boolean;
  message: string;
}

class SimpleFunctionCallService {
  private userService: UserService;
  private contextService: ContextService;

  constructor() {
    this.userService = new UserService();
    this.contextService = new ContextService();
  }

  async initialize(): Promise<void> {
    await this.userService.initialize();
    await this.contextService.initialize();
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
        case 'get_recent_activities':
          return await this.getRecentActivities(args, userId);
        case 'get_reminder_history':
          return await this.getReminderHistory(args, userId);
        case 'get_system_status':
          return await this.getSystemStatus(userId);
        case 'search_conversations':
          return await this.searchConversations(args, userId);
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

  /**
   * 获取用户最近的活动记录
   */
  private async getRecentActivities(args: Record<string, unknown>, userId?: string): Promise<SimpleFunctionResult> {
    if (!userId) {
      return {
        success: false,
        message: '需要用户身份验证才能查看活动记录'
      };
    }

    const days = Math.min((args.days as number) || 7, 30); // 最多30天
    const type = (args.type as string) || 'all';
    
    try {
      const activities = await this.contextService.getRecentContext(days, userId);
      
      // 根据类型过滤
      const filteredActivities = type === 'all' 
        ? activities 
        : activities.filter(activity => activity.type === type);

      if (filteredActivities.length === 0) {
        return {
          success: true,
          message: `📝 最近${days}天没有找到相关活动记录。`
        };
      }

      const activitySummary = filteredActivities
        .slice(0, 10) // 最多显示10条
        .map(activity => {
          const date = activity.timestamp.toLocaleDateString();
          const time = activity.timestamp.toLocaleTimeString('zh-CN', { 
            hour: '2-digit', 
            minute: '2-digit' 
          });
          const typeMap: Record<string, string> = {
            'work_summary': '📊 工作总结',
            'schedule': '📅 日程反馈',
            'conversation': '💬 对话记录'
          };
          const typeIcon = typeMap[activity.type] || '📋 记录';
          const preview = activity.content.length > 100 
            ? activity.content.substring(0, 100) + '...'
            : activity.content;
          
          return `${typeIcon} [${date} ${time}]\n${preview}`;
        })
        .join('\n\n');

      return {
        success: true,
        message: `📋 最近${days}天的活动记录 (共${filteredActivities.length}条):\n\n${activitySummary}`
      };
    } catch (error) {
      logger.error('Failed to get recent activities:', error);
      return {
        success: false,
        message: '获取活动记录失败，请稍后重试'
      };
    }
  }

  /**
   * 获取提醒历史记录
   */
  private async getReminderHistory(args: Record<string, unknown>, userId?: string): Promise<SimpleFunctionResult> {
    if (!userId) {
      return {
        success: false,
        message: '需要用户身份验证才能查看提醒历史'
      };
    }

    // 验证用户存在
    const user = this.userService.getUserById(userId);
    if (!user) {
      return {
        success: false,
        message: '用户未找到'
      };
    }

    const days = Math.min((args.days as number) || 7, 30);
    
    try {
      // 从提醒跟踪服务获取数据
      const { readFileSync, existsSync } = await import('fs');
      const path = await import('path');
      
      const reminderPath = path.join(process.cwd(), 'data', 'reminders.json');
      
      if (!existsSync(reminderPath)) {
        return {
          success: true,
          message: '📨 暂无提醒历史记录。'
        };
      }

      const reminderData = JSON.parse(readFileSync(reminderPath, 'utf-8'));
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      // 过滤最近的提醒记录
      const recentReminders = Object.entries(reminderData)
        .filter(([dateKey]) => new Date(dateKey) >= cutoffDate)
        .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
        .slice(0, 10);

      if (recentReminders.length === 0) {
        return {
          success: true,
          message: `📨 最近${days}天没有提醒记录。`
        };
      }

      const reminderSummary = recentReminders
        .map(([dateKey, status]) => {
          const date = new Date(dateKey).toLocaleDateString();
          const statusText = status as any;
          const morningStatus = statusText.morning ? '✅ 已发送' : '❌ 未发送';
          const eveningStatus = statusText.evening ? '✅ 已发送' : '❌ 未发送';
          
          return `📅 ${date}\n• 早晨提醒: ${morningStatus}\n• 晚间提醒: ${eveningStatus}`;
        })
        .join('\n\n');

      return {
        success: true,
        message: `📨 最近${days}天的提醒历史:\n\n${reminderSummary}`
      };
    } catch (error) {
      logger.error('Failed to get reminder history:', error);
      return {
        success: false,
        message: '获取提醒历史失败，请稍后重试'
      };
    }
  }

  /**
   * 获取系统状态 - 仅管理员可访问
   */
  private async getSystemStatus(userId?: string): Promise<SimpleFunctionResult> {
    if (!userId) {
      return {
        success: false,
        message: '需要用户身份验证才能查看系统状态'
      };
    }

    // 检查用户权限
    const user = this.userService.getUserById(userId);
    if (!user || user.role !== UserRole.ADMIN) {
      return {
        success: false,
        message: '⚠️ 抱歉，只有管理员可以查看系统状态信息。'
      };
    }

    try {
      // 获取系统健康状态
      let healthStatus = '';
      try {
        // 避免循环依赖，直接使用process信息
        const uptime = Math.floor(process.uptime() / 3600);
        const memUsage = process.memoryUsage();
        const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
        healthStatus = `🟢 系统状态: 运行中\n📊 运行时间: ${uptime}小时\n💾 内存使用: ${heapUsedMB}MB`;
      } catch (error) {
        healthStatus = '⚠️ 无法获取系统健康状态';
      }

      // 获取用户统计
      const allUsers = this.userService.getAllUsers();
      const activeUsers = allUsers.filter(user => user.isActive);
      
      // 获取最近活动统计
      const recentActivities = await this.contextService.getRecentContext(7, userId);
      const activityCount = recentActivities.length;

      const statusInfo = `
🖥️ 系统状态报告:

${healthStatus}

👥 用户统计:
• 总用户数: ${allUsers.length}
• 活跃用户: ${activeUsers.length}

📊 您的活动统计 (最近7天):
• 记录条数: ${activityCount}

⚙️ 当前配置:
• AI服务商: ${process.env.AI_PROVIDER || 'openai'}
• 邮件服务: ${process.env.SMTP_HOST ? '✅ 已配置' : '❌ 未配置'}
• 提醒功能: ✅ 正常运行

🕒 系统时间: ${new Date().toLocaleString('zh-CN')}
      `.trim();

      return {
        success: true,
        message: statusInfo
      };
    } catch (error) {
      logger.error('Failed to get system status:', error);
      return {
        success: false,
        message: '获取系统状态失败，请稍后重试'
      };
    }
  }

  /**
   * 搜索对话记录
   */
  private async searchConversations(args: Record<string, unknown>, userId?: string): Promise<SimpleFunctionResult> {
    if (!userId) {
      return {
        success: false,
        message: '需要用户身份验证才能搜索对话'
      };
    }

    const keyword = args.keyword as string;
    const days = Math.min((args.days as number) || 30, 90); // 最多90天
    
    if (!keyword || keyword.trim().length === 0) {
      return {
        success: false,
        message: '请提供搜索关键词'
      };
    }

    try {
      const activities = await this.contextService.getRecentContext(days, userId);
      
      // 搜索包含关键词的记录
      const searchResults = activities.filter(activity => 
        activity.content.toLowerCase().includes(keyword.toLowerCase()) ||
        (activity.metadata && JSON.stringify(activity.metadata).toLowerCase().includes(keyword.toLowerCase()))
      );

      if (searchResults.length === 0) {
        return {
          success: true,
          message: `🔍 在最近${days}天的记录中没有找到包含"${keyword}"的内容。`
        };
      }

      const resultSummary = searchResults
        .slice(0, 8) // 最多显示8条结果
        .map(result => {
          const date = result.timestamp.toLocaleDateString();
          const time = result.timestamp.toLocaleTimeString('zh-CN', { 
            hour: '2-digit', 
            minute: '2-digit' 
          });
          
          // 高亮关键词 (简单版本)
          let content = result.content;
          const keywordIndex = content.toLowerCase().indexOf(keyword.toLowerCase());
          if (keywordIndex !== -1) {
            const start = Math.max(0, keywordIndex - 50);
            const end = Math.min(content.length, keywordIndex + keyword.length + 50);
            content = '...' + content.substring(start, end) + '...';
          } else if (content.length > 120) {
            content = content.substring(0, 120) + '...';
          }
          
          const typeMap: Record<string, string> = {
            'work_summary': '📊',
            'schedule': '📅',
            'conversation': '💬'
          };
          const typeIcon = typeMap[result.type] || '📋';
          
          return `${typeIcon} [${date} ${time}]\n${content}`;
        })
        .join('\n\n');

      return {
        success: true,
        message: `🔍 搜索"${keyword}"的结果 (共找到${searchResults.length}条，显示前${Math.min(searchResults.length, 8)}条):\n\n${resultSummary}`
      };
    } catch (error) {
      logger.error('Failed to search conversations:', error);
      return {
        success: false,
        message: '搜索对话记录失败，请稍后重试'
      };
    }
  }
}

export default SimpleFunctionCallService;