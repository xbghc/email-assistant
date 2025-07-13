import { AdminCommand, UserConfig } from '../../models/User';
import UserService from '../user/userService';
import EmailService from '../email/emailService';
import WeeklyReportService from '../reports/weeklyReportService';
import PersonalizationService from '../reports/personalizationService';
import SchedulerService from '../core/schedulerService';
import logger from '../../utils/logger';
import config from '../../config/index';

class AdminCommandService {
  private userService: UserService;
  private emailService: EmailService;
  private weeklyReportService: WeeklyReportService;
  private personalizationService: PersonalizationService;
  private schedulerService?: SchedulerService | undefined;
  private commands: Map<string, AdminCommand>;

  constructor(userService: UserService, schedulerService?: SchedulerService) {
    this.userService = userService;
    this.emailService = new EmailService();
    this.weeklyReportService = new WeeklyReportService();
    this.personalizationService = new PersonalizationService();
    // 避免循环依赖：只有明确传入时才使用SchedulerService
    this.schedulerService = schedulerService || undefined;
    this.commands = new Map();
    this.initializeCommands();
  }

  private initializeCommands(): void {
    // 添加用户命令
    this.commands.set('adduser', {
      command: 'adduser',
      description: '添加新用户',
      usage: '/adduser <email> <name> [morningTime] [eveningTime]',
      handler: this.handleAddUser.bind(this)
    });

    // 列出所有用户
    this.commands.set('listusers', {
      command: 'listusers',
      description: '列出所有用户',
      usage: '/listusers',
      handler: this.handleListUsers.bind(this)
    });

    // 删除用户
    this.commands.set('deleteuser', {
      command: 'deleteuser',
      description: '删除用户',
      usage: '/deleteuser <email>',
      handler: this.handleDeleteUser.bind(this)
    });

    // 启用/禁用用户
    this.commands.set('enableuser', {
      command: 'enableuser',
      description: '启用用户',
      usage: '/enableuser <email>',
      handler: this.handleEnableUser.bind(this)
    });

    this.commands.set('disableuser', {
      command: 'disableuser',
      description: '禁用用户',
      usage: '/disableuser <email>',
      handler: this.handleDisableUser.bind(this)
    });

    // 修改用户名
    this.commands.set('rename', {
      command: 'rename',
      description: '修改用户名',
      usage: '/rename <email> <newName>',
      handler: this.handleRenameUser.bind(this)
    });

    // 更新用户配置
    this.commands.set('updateuser', {
      command: 'updateuser',
      description: '更新用户配置',
      usage: '/updateuser <email> <field> <value>',
      handler: this.handleUpdateUser.bind(this)
    });

    // 用户统计
    this.commands.set('stats', {
      command: 'stats',
      description: '显示用户统计信息',
      usage: '/stats',
      handler: this.handleStats.bind(this)
    });

    // 周报生成
    this.commands.set('weeklyreport', {
      command: 'weeklyreport',
      description: '生成用户周报',
      usage: '/weeklyreport [email] [weekOffset]',
      handler: this.handleWeeklyReport.bind(this)
    });

    // 个性化建议
    this.commands.set('suggestions', {
      command: 'suggestions',
      description: '生成个性化工作建议',
      usage: '/suggestions [email]',
      handler: this.handlePersonalizedSuggestions.bind(this)
    });

    // 取消提醒命令
    this.commands.set('cancelreminder', {
      command: 'cancelreminder',
      description: '取消今天的提醒（晨间或晚间）',
      usage: '/cancelreminder <type> [email] (type: morning|evening|all)',
      handler: this.handleCancelReminder.bind(this)
    });

    // 暂停用户提醒
    this.commands.set('pausereminder', {
      command: 'pausereminder',
      description: '暂停用户的提醒功能',
      usage: '/pausereminder <email> [days]',
      handler: this.handlePauseReminder.bind(this)
    });

    // 恢复用户提醒
    this.commands.set('resumereminder', {
      command: 'resumereminder',
      description: '恢复用户的提醒功能',
      usage: '/resumereminder <email>',
      handler: this.handleResumeReminder.bind(this)
    });

    // 帮助命令
    this.commands.set('help', {
      command: 'help',
      description: '显示帮助信息',
      usage: '/help [command]',
      handler: this.handleHelp.bind(this)
    });
  }

  isAdminCommand(subject: string): boolean {
    return subject.startsWith('/') && subject.length > 1;
  }

  async processCommand(subject: string, _content: string): Promise<string> {
    try {
      const parts = subject.slice(1).split(' ');
      const command = parts[0]?.toLowerCase();
      const args = parts.slice(1);

      if (!command) {
        return '命令不能为空。使用 /help 查看可用命令。';
      }

      logger.info(`Processing admin command: ${command} with args: ${args.join(', ')}`);

      const commandHandler = this.commands.get(command);
      if (!commandHandler) {
        return `未知命令: ${command}。使用 /help 查看可用命令。`;
      }

      return await commandHandler.handler(args);
    } catch (error) {
      logger.error('Failed to process admin command:', error);
      return `命令执行失败: ${error instanceof Error ? error.message : '未知错误'}`;
    }
  }

  private async handleAddUser(args: string[]): Promise<string> {
    if (args.length < 2) {
      return '用法: /adduser <email> <name> [morningTime] [eveningTime]';
    }

    const [email, name, morningTime, eveningTime] = args;

    if (!email || !name) {
      return '请提供邮箱和姓名';
    }

    // 检查用户是否已存在
    if (this.userService.getUserByEmail(email)) {
      return `用户 ${email} 已存在`;
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return '邮箱格式无效';
    }

    // 验证时间格式
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (morningTime && !timeRegex.test(morningTime)) {
      return '早晨时间格式无效，请使用 HH:MM 格式';
    }
    if (eveningTime && !timeRegex.test(eveningTime)) {
      return '晚间时间格式无效，请使用 HH:MM 格式';
    }

    const customConfig = {
      schedule: {
        morningReminderTime: morningTime || '09:00',
        eveningReminderTime: eveningTime || '18:00',
        timezone: 'Asia/Shanghai'
      },
      language: 'zh' as const
    };

    const user = this.userService.createUser(email, name, customConfig);
    this.userService.addUser(user);

    // 发送欢迎邮件给新用户
    try {
      await this.emailService.sendNewUserWelcomeEmail(
        name,
        email,
        user.config.schedule.morningReminderTime,
        user.config.schedule.eveningReminderTime
      );
      
      // 发送通知邮件给管理员
      await this.emailService.sendUserAddedNotification(
        config.email.name,
        name,
        email
      );
      
      logger.debug(`Welcome email sent to new user: ${email}`);
    } catch (error) {
      logger.error(`Failed to send welcome email to ${email}:`, error);
    }

    return `用户添加成功：
📧 邮箱: ${email}
👤 姓名: ${name}
🌅 早晨提醒: ${user.config.schedule.morningReminderTime}
🌆 晚间提醒: ${user.config.schedule.eveningReminderTime}
✅ 状态: 已启用
📬 欢迎邮件: 已发送`;
  }

  private async handleListUsers(_args: string[]): Promise<string> {
    const users = this.userService.getAllUsers();
    
    if (users.length === 0) {
      return '暂无用户';
    }

    const userList = users.map(user => {
      const status = user.isActive ? '✅ 启用' : '❌ 禁用';
      return `👤 ${user.name} (${user.email}) - ${status}
   🌅 早晨: ${user.config.schedule.morningReminderTime}
   🌆 晚间: ${user.config.schedule.eveningReminderTime}
   📅 创建: ${user.createdAt.toLocaleDateString()}`;
    }).join('\n\n');

    return `用户列表 (${users.length} 个用户):\n\n${userList}`;
  }

  private async handleDeleteUser(args: string[]): Promise<string> {
    if (args.length < 1) {
      return '用法: /deleteuser <email>';
    }

    const email = args[0];
    if (!email) {
      return '请提供邮箱地址';
    }

    const user = this.userService.getUserByEmail(email);
    if (!user) {
      return `用户 ${email} 不存在`;
    }

    this.userService.deleteUser(user.id);
    return `用户 ${email} (${user.name}) 已删除`;
  }

  private async handleEnableUser(args: string[]): Promise<string> {
    if (args.length < 1) {
      return '用法: /enableuser <email>';
    }

    const email = args[0];
    if (!email) {
      return '请提供邮箱地址';
    }
    
    const user = this.userService.getUserByEmail(email);
    if (!user) {
      return `用户 ${email} 不存在`;
    }

    if (user.isActive) {
      return `用户 ${email} 已经是启用状态`;
    }

    this.userService.updateUser(user.id, { isActive: true });
    return `用户 ${email} (${user.name}) 已启用`;
  }

  private async handleDisableUser(args: string[]): Promise<string> {
    if (args.length < 1) {
      return '用法: /disableuser <email>';
    }

    const email = args[0];
    if (!email) {
      return '请提供邮箱地址';
    }
    
    const user = this.userService.getUserByEmail(email);
    if (!user) {
      return `用户 ${email} 不存在`;
    }

    if (!user.isActive) {
      return `用户 ${email} 已经是禁用状态`;
    }

    this.userService.updateUser(user.id, { isActive: false });
    return `用户 ${email} (${user.name}) 已禁用`;
  }

  private async handleRenameUser(args: string[]): Promise<string> {
    if (args.length < 2) {
      return '用法: /rename <email> <newName>';
    }

    const [email, ...nameParts] = args;
    const newName = nameParts.join(' ').trim();
    
    if (!email) {
      return '请提供邮箱地址';
    }
    
    if (!newName) {
      return '请提供新的用户名';
    }
    
    const user = this.userService.getUserByEmail(email);
    if (!user) {
      return `用户 ${email} 不存在`;
    }

    const oldName = user.name;
    this.userService.updateUser(user.id, { name: newName });
    
    // 发送更名通知邮件给用户
    try {
      const subject = `📝 用户名更新通知`;
      const content = `
您好，

您的用户名已经更新：

旧名称：${oldName}
新名称：${newName}

更新时间：${new Date().toLocaleString()}

如有疑问，请联系管理员。

此致，
邮件助手系统
      `.trim();

      await this.emailService.sendEmailToUser(user.email, subject, content);
      logger.debug(`Name change notification sent to user: ${user.email}`);
    } catch (error) {
      logger.error(`Failed to send name change notification to ${user.email}:`, error);
    }

    return `用户 ${email} 的姓名已从 "${oldName}" 更新为 "${newName}"`;
  }

  private async handleUpdateUser(args: string[]): Promise<string> {
    if (args.length < 3) {
      return '用法: /updateuser <email> <field> <value>\n支持的字段: name, morningTime, eveningTime, language';
    }

    const [email, field, value] = args;
    if (!email) {
      return '请提供邮箱地址';
    }
    
    const user = this.userService.getUserByEmail(email);

    if (!user) {
      return `用户 ${email} 不存在`;
    }

    if (!field || !value) {
      return '请提供完整的字段和值';
    }

    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;

    switch (field.toLowerCase()) {
      case 'name':
        this.userService.updateUser(user.id, { name: value });
        return `用户 ${email} 的姓名已更新为: ${value}`;

      case 'morningtime': {
        if (!timeRegex.test(value)) {
          return '时间格式无效，请使用 HH:MM 格式';
        }
        const newMorningConfig: UserConfig = {
          ...user.config,
          schedule: {
            ...user.config?.schedule,
            morningReminderTime: value,
            eveningReminderTime: user.config?.schedule?.eveningReminderTime || '20:00',
            timezone: user.config?.schedule?.timezone || 'Asia/Shanghai'
          },
          language: user.config?.language || 'zh' as const
        };
        this.userService.updateUser(user.id, { config: newMorningConfig });
        return `用户 ${email} 的早晨提醒时间已更新为: ${value}`;
      }

      case 'eveningtime': {
        if (!timeRegex.test(value)) {
          return '时间格式无效，请使用 HH:MM 格式';
        }
        const newEveningConfig: UserConfig = {
          ...user.config,
          schedule: {
            ...user.config?.schedule,
            eveningReminderTime: value,
            morningReminderTime: user.config?.schedule?.morningReminderTime || '08:00',
            timezone: user.config?.schedule?.timezone || 'Asia/Shanghai'
          },
          language: user.config?.language || 'zh' as const
        };
        this.userService.updateUser(user.id, { config: newEveningConfig });
        return `用户 ${email} 的晚间提醒时间已更新为: ${value}`;
      }

      case 'language': {
        if (value !== 'zh' && value !== 'en') {
          return '语言必须是 zh 或 en';
        }
        const newLangConfig: UserConfig = {
          ...user.config,
          language: value as 'zh' | 'en',
          schedule: user.config?.schedule || {
            morningReminderTime: '08:00',
            eveningReminderTime: '20:00',
            timezone: 'Asia/Shanghai'
          }
        };
        this.userService.updateUser(user.id, { config: newLangConfig });
        return `用户 ${email} 的语言已更新为: ${value}`;
      }

      default:
        return `未知字段: ${field}。支持的字段: name, morningTime, eveningTime, language`;
    }
  }

  private async handleStats(_args: string[]): Promise<string> {
    const stats = this.userService.getStats();
    
    return `📊 用户统计信息:
👥 总用户数: ${stats.total}
✅ 活跃用户: ${stats.active}
❌ 禁用用户: ${stats.inactive}`;
  }

  private async handleWeeklyReport(args: string[]): Promise<string> {
    try {
      // 初始化周报服务
      await this.weeklyReportService.initialize();
      
      if (args.length === 0) {
        // 生成所有用户的周报
        await this.weeklyReportService.generateAllUsersWeeklyReports();
        return '✅ 已为所有活跃用户生成并发送本周周报';
      }
      
      const [emailOrOffset, weekOffsetStr] = args;
      
      if (!emailOrOffset) {
        return '❌ 请提供用户邮箱或周偏移量';
      }
      
      // 如果第一个参数是数字，则是为管理员生成指定周的周报
      if (!isNaN(Number(emailOrOffset))) {
        const weekOffset = parseInt(emailOrOffset);
        await this.weeklyReportService.generateAndSendWeeklyReport('admin', weekOffset);
        const weekDescription = weekOffset === 0 ? '本周' : weekOffset > 0 ? `${weekOffset}周后` : `${Math.abs(weekOffset)}周前`;
        return `✅ 已生成并发送管理员${weekDescription}的周报`;
      }
      
      // 否则是为指定用户生成周报
      const email = emailOrOffset;
      const user = this.userService.getUserByEmail(email);
      if (!user) {
        return `❌ 用户 ${email} 不存在`;
      }
      
      const weekOffset = weekOffsetStr ? parseInt(weekOffsetStr) : 0;
      if (isNaN(weekOffset)) {
        return '❌ 周偏移量必须是数字（0=本周，-1=上周，1=下周）';
      }
      
      await this.weeklyReportService.generateAndSendWeeklyReport(user.id, weekOffset);
      const weekDescription = weekOffset === 0 ? '本周' : weekOffset > 0 ? `${weekOffset}周后` : `${Math.abs(weekOffset)}周前`;
      
      return `✅ 已为用户 ${email} 生成并发送${weekDescription}的周报`;
      
    } catch (error) {
      logger.error('Failed to generate weekly report:', error);
      return `❌ 生成周报失败: ${error instanceof Error ? error.message : '未知错误'}`;
    }
  }

  private async handlePersonalizedSuggestions(args: string[]): Promise<string> {
    try {
      // 初始化个性化服务
      await this.personalizationService.initialize();
      
      if (args.length === 0) {
        // 为所有用户生成个性化建议
        await this.personalizationService.generatePersonalizedSuggestionsForAllUsers();
        return '✅ 已为所有活跃用户生成并发送个性化建议';
      }
      
      const [email] = args;
      if (!email) {
        return '❌ 请提供用户邮箱地址';
      }
      
      const user = this.userService.getUserByEmail(email);
      if (!user) {
        return `❌ 用户 ${email} 不存在`;
      }
      
      await this.personalizationService.sendPersonalizedSuggestions(user.id);
      return `✅ 已为用户 ${email} 生成并发送个性化建议`;
      
    } catch (error) {
      logger.error('Failed to generate personalized suggestions:', error);
      return `❌ 生成个性化建议失败: ${error instanceof Error ? error.message : '未知错误'}`;
    }
  }

  private async handleHelp(args: string[]): Promise<string> {
    if (args.length > 0) {
      const command = args[0]?.toLowerCase();
      if (!command) {
        return '命令不能为空';
      }
      const commandHandler = this.commands.get(command);
      
      if (!commandHandler) {
        return `未知命令: ${command}`;
      }

      return `📖 ${commandHandler.command} - ${commandHandler.description}
用法: ${commandHandler.usage}`;
    }

    const commandList = Array.from(this.commands.values())
      .map(cmd => `/${cmd.command} - ${cmd.description}`)
      .join('\n');

    return `📚 可用的管理员命令:\n\n${commandList}\n\n使用 /help <命令> 查看详细用法`;
  }

  private async handleCancelReminder(args: string[]): Promise<string> {
    if (args.length < 1) {
      return '用法: /cancelreminder <type> [email]\n类型: morning（晨间）, evening（晚间）, all（全部）';
    }

    const [type, email] = args;
    
    if (!type) {
      return '❌ 请提供提醒类型';
    }
    
    const userId = email ? this.getUserIdByEmail(email) : 'admin';
    
    if (email && !userId) {
      return `❌ 用户 ${email} 不存在`;
    }

    const userEmail = email || 'admin';
    const finalUserId = userId || 'admin';

    try {
      switch (type.toLowerCase()) {
        case 'morning':
        case '晨间':
          // 标记晨间提醒已发送，这样就不会再发送了
          if (this.schedulerService) {
            await this.schedulerService.markMorningReminderSent(finalUserId);
          }
          return `✅ 已取消用户 ${userEmail} 今天的晨间提醒`;

        case 'evening':
        case '晚间':
          // 标记晚间提醒已发送，这样就不会再发送了
          if (this.schedulerService) {
            await this.schedulerService.markEveningReminderSent(finalUserId);
          }
          return `✅ 已取消用户 ${userEmail} 今天的晚间提醒`;

        case 'all':
        case '全部':
          // 标记所有提醒已发送
          if (this.schedulerService) {
            await this.schedulerService.markMorningReminderSent(finalUserId);
            await this.schedulerService.markEveningReminderSent(finalUserId);
          }
          return `✅ 已取消用户 ${userEmail} 今天的所有提醒`;

        default:
          return `❌ 未知的提醒类型: ${type}\n支持的类型: morning（晨间）, evening（晚间）, all（全部）`;
      }
    } catch (error) {
      logger.error('Failed to cancel reminder:', error);
      return `❌ 取消提醒失败: ${error instanceof Error ? error.message : '未知错误'}`;
    }
  }

  private async handlePauseReminder(args: string[]): Promise<string> {
    if (args.length < 1) {
      return '用法: /pausereminder <email> [days]';
    }

    const [email, daysStr] = args;
    const days = daysStr ? parseInt(daysStr) : 1;

    if (!email) {
      return '❌ 请提供用户邮箱地址';
    }

    if (isNaN(days) || days <= 0) {
      return '❌ 暂停天数必须是正整数';
    }

    const user = this.userService.getUserByEmail(email);
    if (!user) {
      return `❌ 用户 ${email} 不存在`;
    }

    try {
      // 计算恢复日期
      const resumeDate = new Date();
      resumeDate.setDate(resumeDate.getDate() + days);

      // 更新用户配置，添加暂停信息
      const newConfig: UserConfig = {
        ...user.config,
        reminderPaused: true,
        resumeDate: resumeDate.toISOString(),
        schedule: user.config?.schedule || {
          morningReminderTime: '09:00',
          eveningReminderTime: '18:00',
          timezone: 'Asia/Shanghai'
        },
        language: user.config?.language || 'zh' as const
      };

      this.userService.updateUser(user.id, { config: newConfig });

      // 发送暂停通知邮件
      try {
        const subject = `⏸️ 提醒功能已暂停`;
        const content = `
您好 ${user.name}，

您的提醒功能已经暂停：

暂停天数：${days} 天
恢复日期：${resumeDate.toLocaleDateString()}

在此期间，您将不会收到晨间和晚间提醒邮件。

如需提前恢复，请联系管理员。

此致，
邮件助手系统
        `.trim();

        await this.emailService.sendEmailToUser(user.email, subject, content);
        logger.debug(`Reminder pause notification sent to user: ${user.email}`);
      } catch (error) {
        logger.error(`Failed to send pause notification to ${user.email}:`, error);
      }

      return `✅ 已暂停用户 ${email} 的提醒功能 ${days} 天\n恢复日期: ${resumeDate.toLocaleDateString()}`;
    } catch (error) {
      logger.error('Failed to pause reminder:', error);
      return `❌ 暂停提醒失败: ${error instanceof Error ? error.message : '未知错误'}`;
    }
  }

  private async handleResumeReminder(args: string[]): Promise<string> {
    if (args.length < 1) {
      return '用法: /resumereminder <email>';
    }

    const [email] = args;

    if (!email) {
      return '❌ 请提供用户邮箱地址';
    }

    const user = this.userService.getUserByEmail(email);
    if (!user) {
      return `❌ 用户 ${email} 不存在`;
    }

    if (!user.config?.reminderPaused) {
      return `✅ 用户 ${email} 的提醒功能本来就是启用状态`;
    }

    try {
      // 更新用户配置，移除暂停信息
      const restConfig = { ...user.config };
      delete (restConfig as { resumeDate?: string }).resumeDate;

      const newConfig: UserConfig = {
        ...restConfig,
        reminderPaused: false,
        schedule: user.config?.schedule || {
          morningReminderTime: '09:00',
          eveningReminderTime: '18:00',
          timezone: 'Asia/Shanghai'
        },
        language: user.config?.language || 'zh' as const
      };

      this.userService.updateUser(user.id, { config: newConfig });

      // 发送恢复通知邮件
      try {
        const subject = `▶️ 提醒功能已恢复`;
        const content = `
您好 ${user.name}，

您的提醒功能已经恢复正常：

恢复时间：${new Date().toLocaleString()}
晨间提醒：${user.config?.schedule?.morningReminderTime || '09:00'}
晚间提醒：${user.config?.schedule?.eveningReminderTime || '18:00'}

从明天开始，您将正常收到提醒邮件。

此致，
邮件助手系统
        `.trim();

        await this.emailService.sendEmailToUser(user.email, subject, content);
        logger.debug(`Reminder resume notification sent to user: ${user.email}`);
      } catch (error) {
        logger.error(`Failed to send resume notification to ${user.email}:`, error);
      }

      return `✅ 已恢复用户 ${email} 的提醒功能`;
    } catch (error) {
      logger.error('Failed to resume reminder:', error);
      return `❌ 恢复提醒失败: ${error instanceof Error ? error.message : '未知错误'}`;
    }
  }

  private getUserIdByEmail(email: string): string | null {
    const user = this.userService.getUserByEmail(email);
    return user ? user.id : null;
  }

}

export default AdminCommandService;