import { AdminCommand, UserConfig } from '../models/User';
import UserService from './userService';
import EmailService from './emailService';
import logger from '../utils/logger';
import config from '../config';

class AdminCommandService {
  private userService: UserService;
  private emailService: EmailService;
  private commands: Map<string, AdminCommand>;

  constructor(userService: UserService) {
    this.userService = userService;
    this.emailService = new EmailService();
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
        config.email.user.name,
        name,
        email
      );
      
      logger.info(`Welcome email sent to new user: ${email}`);
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

    await this.userService.updateUser(user.id, { isActive: true });
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

    await this.userService.updateUser(user.id, { isActive: false });
    return `用户 ${email} (${user.name}) 已禁用`;
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
        await this.userService.updateUser(user.id, { name: value });
        return `用户 ${email} 的姓名已更新为: ${value}`;

      case 'morningtime':
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
        await this.userService.updateUser(user.id, { config: newMorningConfig });
        return `用户 ${email} 的早晨提醒时间已更新为: ${value}`;

      case 'eveningtime':
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
        await this.userService.updateUser(user.id, { config: newEveningConfig });
        return `用户 ${email} 的晚间提醒时间已更新为: ${value}`;

      case 'language':
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
        await this.userService.updateUser(user.id, { config: newLangConfig });
        return `用户 ${email} 的语言已更新为: ${value}`;

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
}

export default AdminCommandService;