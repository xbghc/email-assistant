import fs from 'fs/promises';
import path from 'path';
import logger from '../../utils/logger';

export interface EmailConfig {
  user: string;
  pass: string;
  name: string;
  smtp: {
    host: string;
    port: number;
  };
  imap: {
    host: string;
    port: number;
    tls: boolean;
  };
  forwarding: {
    enabled: boolean;
    markAsRead: boolean;
  };
  admin: {
    email: string;
  };
}

export interface AIConfig {
  provider: 'openai' | 'deepseek' | 'google' | 'anthropic' | 'azure' | 'mock';
  model: string;
  apiKey: string;
  baseURL?: string;
}

export interface ScheduleConfig {
  morningReminderTime: string;
  eveningReminderTime: string;
  timezone: string;
  weeklyReportDay: number; // 0-6, 0 = Sunday
  weeklyReportTime: string;
}

export interface SystemConfig {
  email: EmailConfig;
  ai: AIConfig;
  schedule: ScheduleConfig;
  server: {
    port: number;
    host: string;
    logLevel: string;
  };
  features: {
    enableWebInterface: boolean;
    enableEmailReceiver: boolean;
    enableWeeklyReports: boolean;
    enablePersonalizedSuggestions: boolean;
  };
}

class ConfigService {
  private configFilePath: string;
  private config: SystemConfig | null = null;

  constructor() {
    this.configFilePath = path.join(process.cwd(), '.env');
  }

  /**
   * 初始化配置服务
   */
  async initialize(): Promise<void> {
    try {
      await this.loadConfig();
      logger.info('Config service initialized');
    } catch (error) {
      logger.error('Failed to initialize config service:', error);
    }
  }

  /**
   * 从.env文件加载配置
   */
  async loadConfig(): Promise<SystemConfig> {
    try {
      // 检查.env文件是否存在
      const exists = await this.fileExists(this.configFilePath);
      if (!exists) {
        throw new Error('.env file not found');
      }

      // 读取.env文件
      const envContent = await fs.readFile(this.configFilePath, 'utf-8');
      const envVars = this.parseEnvFile(envContent);

      // 构建配置对象
      this.config = {
        email: {
          user: envVars.EMAIL_USER || envVars.SMTP_USER || '',
          pass: envVars.EMAIL_PASS || envVars.SMTP_PASS || '',
          name: envVars.USER_NAME || 'User',
          smtp: {
            host: envVars.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(envVars.SMTP_PORT || '587')
          },
          imap: {
            host: envVars.IMAP_HOST || 'imap.gmail.com',
            port: parseInt(envVars.IMAP_PORT || '993'),
            tls: envVars.IMAP_TLS !== 'false'
          },
          forwarding: {
            enabled: envVars.EMAIL_FORWARDING_ENABLED !== 'false',
            markAsRead: envVars.EMAIL_FORWARDING_MARK_READ !== 'false'
          },
          admin: {
            email: envVars.ADMIN_EMAIL || ''
          }
        },
        ai: {
          provider: (envVars.AI_PROVIDER as AIConfig['provider']) || 'openai',
          model: envVars.AI_MODEL || 'gpt-3.5-turbo',
          apiKey: envVars.OPENAI_API_KEY || envVars.DEEPSEEK_API_KEY || envVars.GOOGLE_API_KEY || '',
          ...(envVars.AI_BASE_URL && { baseURL: envVars.AI_BASE_URL })
        },
        schedule: {
          morningReminderTime: envVars.MORNING_REMINDER_TIME || '08:00',
          eveningReminderTime: envVars.EVENING_REMINDER_TIME || '20:00',
          timezone: envVars.TIMEZONE || 'Asia/Shanghai',
          weeklyReportDay: parseInt(envVars.WEEKLY_REPORT_DAY || '1'), // Monday
          weeklyReportTime: envVars.WEEKLY_REPORT_TIME || '09:00'
        },
        server: {
          port: parseInt(envVars.PORT || '3000'),
          host: envVars.HOST || '0.0.0.0',
          logLevel: envVars.LOG_LEVEL || 'info'
        },
        features: {
          enableWebInterface: envVars.ENABLE_WEB_INTERFACE !== 'false',
          enableEmailReceiver: envVars.ENABLE_EMAIL_RECEIVER !== 'false',
          enableWeeklyReports: envVars.ENABLE_WEEKLY_REPORTS !== 'false',
          enablePersonalizedSuggestions: envVars.ENABLE_PERSONALIZED_SUGGESTIONS !== 'false'
        }
      };

      logger.debug('Configuration loaded successfully');
      if (!this.config) {
        throw new Error('Failed to initialize configuration');
      }
      return this.config;
    } catch (error) {
      logger.error('Failed to load configuration:', error);
      throw error;
    }
  }

  /**
   * 保存配置到.env文件
   */
  async saveConfig(newConfig: Partial<SystemConfig>): Promise<void> {
    try {
      if (!this.config) {
        await this.loadConfig();
      }

      // 合并配置
      if (!this.config) {
        throw new Error('Configuration not initialized');
      }
      const updatedConfig = this.mergeConfig(this.config, newConfig);
      
      // 生成新的.env内容
      const envContent = this.generateEnvContent(updatedConfig);
      
      // 备份现有配置
      await this.backupConfig();
      
      // 写入新配置
      await fs.writeFile(this.configFilePath, envContent, 'utf-8');
      
      // 更新内存中的配置
      this.config = updatedConfig;
      
      logger.info('Configuration saved successfully');
    } catch (error) {
      logger.error('Failed to save configuration:', error);
      throw error;
    }
  }

  /**
   * 获取当前配置
   */
  getConfig(): SystemConfig | null {
    return this.config;
  }

  /**
   * 获取特定配置部分
   */
  getEmailConfig(): EmailConfig | null {
    return this.config?.email || null;
  }

  getAIConfig(): AIConfig | null {
    return this.config?.ai || null;
  }

  getScheduleConfig(): ScheduleConfig | null {
    return this.config?.schedule || null;
  }

  /**
   * 验证配置完整性
   */
  validateConfig(config: SystemConfig): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 验证邮件配置
    if (!config.email.smtp.host) errors.push('SMTP host is required');
    if (!config.email.user) errors.push('Email user is required');
    if (!config.email.admin.email) errors.push('Admin email is required');

    // 验证AI配置
    if (config.ai.provider !== 'mock' && !config.ai.apiKey) {
      errors.push('AI API key is required for non-mock providers');
    }

    // 验证时间格式
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(config.schedule.morningReminderTime)) {
      errors.push('Invalid morning reminder time format (use HH:MM)');
    }
    if (!timeRegex.test(config.schedule.eveningReminderTime)) {
      errors.push('Invalid evening reminder time format (use HH:MM)');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 解析.env文件内容
   */
  private parseEnvFile(content: string): Record<string, string> {
    const envVars: Record<string, string> = {};
    
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').replace(/^["']|["']$/g, '');
          envVars[key.trim()] = value;
        }
      }
    });

    return envVars;
  }

  /**
   * 生成.env文件内容
   */
  private generateEnvContent(config: SystemConfig): string {
    const lines = [
      '# Email Assistant Configuration',
      '# Generated by ConfigService',
      '',
      '# Email Configuration',
      `EMAIL_USER=${config.email.user}`,
      `EMAIL_PASS=${config.email.pass}`,
      `USER_NAME=${config.email.name}`,
      '',
      `SMTP_HOST=${config.email.smtp.host}`,
      `SMTP_PORT=${config.email.smtp.port}`,
      '',
      `IMAP_HOST=${config.email.imap.host}`,
      `IMAP_PORT=${config.email.imap.port}`,
      `IMAP_TLS=${config.email.imap.tls}`,
      '',
      `EMAIL_FORWARDING_ENABLED=${config.email.forwarding.enabled}`,
      `EMAIL_FORWARDING_MARK_READ=${config.email.forwarding.markAsRead}`,
      '',
      `ADMIN_EMAIL=${config.email.admin.email}`,
      '',
      '# AI Configuration',
      `AI_PROVIDER=${config.ai.provider}`,
      `AI_MODEL=${config.ai.model}`,
    ];

    // 根据AI提供商添加相应的API密钥
    switch (config.ai.provider) {
      case 'openai':
        lines.push(`OPENAI_API_KEY=${config.ai.apiKey}`);
        break;
      case 'deepseek':
        lines.push(`DEEPSEEK_API_KEY=${config.ai.apiKey}`);
        break;
      case 'google':
        lines.push(`GOOGLE_API_KEY=${config.ai.apiKey}`);
        break;
      case 'anthropic':
        lines.push(`ANTHROPIC_API_KEY=${config.ai.apiKey}`);
        break;
    }

    if (config.ai.baseURL) {
      lines.push(`AI_BASE_URL=${config.ai.baseURL}`);
    }

    lines.push(
      '',
      '# Schedule Configuration',
      `MORNING_REMINDER_TIME=${config.schedule.morningReminderTime}`,
      `EVENING_REMINDER_TIME=${config.schedule.eveningReminderTime}`,
      `TIMEZONE=${config.schedule.timezone}`,
      `WEEKLY_REPORT_DAY=${config.schedule.weeklyReportDay}`,
      `WEEKLY_REPORT_TIME=${config.schedule.weeklyReportTime}`,
      '',
      '# Server Configuration',
      `PORT=${config.server.port}`,
      `HOST=${config.server.host}`,
      `LOG_LEVEL=${config.server.logLevel}`,
      '',
      '# Feature Flags',
      `ENABLE_WEB_INTERFACE=${config.features.enableWebInterface}`,
      `ENABLE_EMAIL_RECEIVER=${config.features.enableEmailReceiver}`,
      `ENABLE_WEEKLY_REPORTS=${config.features.enableWeeklyReports}`,
      `ENABLE_PERSONALIZED_SUGGESTIONS=${config.features.enablePersonalizedSuggestions}`,
      ''
    );

    return lines.join('\n');
  }

  /**
   * 合并配置对象
   */
  private mergeConfig(existing: SystemConfig, updates: Partial<SystemConfig>): SystemConfig {
    return {
      email: { ...existing.email, ...updates.email },
      ai: { ...existing.ai, ...updates.ai },
      schedule: { ...existing.schedule, ...updates.schedule },
      server: { ...existing.server, ...updates.server },
      features: { ...existing.features, ...updates.features }
    };
  }

  /**
   * 备份配置文件
   */
  private async backupConfig(): Promise<void> {
    try {
      const backupPath = `${this.configFilePath}.backup.${Date.now()}`;
      await fs.copyFile(this.configFilePath, backupPath);
      logger.debug(`Configuration backed up to: ${backupPath}`);
    } catch (error) {
      logger.warn('Failed to backup configuration:', error);
    }
  }

  /**
   * 检查文件是否存在
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 重置为默认配置
   */
  async resetToDefaults(): Promise<void> {
    const defaultConfig: SystemConfig = {
      email: {
        user: '',
        pass: '',
        name: 'User',
        smtp: {
          host: 'smtp.gmail.com',
          port: 587
        },
        imap: {
          host: 'imap.gmail.com',
          port: 993,
          tls: true
        },
        forwarding: {
          enabled: true,
          markAsRead: true
        },
        admin: {
          email: ''
        }
      },
      ai: {
        provider: 'mock',
        model: 'gpt-3.5-turbo',
        apiKey: ''
      },
      schedule: {
        morningReminderTime: '08:00',
        eveningReminderTime: '20:00',
        timezone: 'Asia/Shanghai',
        weeklyReportDay: 1,
        weeklyReportTime: '09:00'
      },
      server: {
        port: 3000,
        host: '0.0.0.0',
        logLevel: 'info'
      },
      features: {
        enableWebInterface: true,
        enableEmailReceiver: true,
        enableWeeklyReports: true,
        enablePersonalizedSuggestions: true
      }
    };

    await this.saveConfig(defaultConfig);
  }
}

export default ConfigService;