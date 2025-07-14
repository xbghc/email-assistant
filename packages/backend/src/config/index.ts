import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createConfigError } from '../utils/errors';

dotenv.config();

// 配置文件类型定义
interface FileConfig {
  email?: {
    forwarding?: {
      enabled?: boolean;
      markAsRead?: boolean;
    };
    startup?: {
      notification?: 'none' | 'admin' | 'all' | 'custom';
      customRecipients?: string[];
    };
  };
  ai?: {
    provider?: AIProvider;
    models?: {
      openai?: string;
      deepseek?: string;
      google?: string;
      anthropic?: string;
    };
    baseUrls?: {
      deepseek?: string;
      azureOpenai?: {
        apiVersion?: string;
      };
    };
  };
  schedule?: {
    morningReminderTime?: string;
    eveningReminderTime?: string;
    timezone?: string;
  };
  context?: {
    maxLength?: number;
    compressionThreshold?: number;
  };
  performance?: {
    email?: {
      connectionTimeout?: number;
      socketTimeout?: number;
      maxConnections?: number;
      maxMessages?: number;
      queueProcessInterval?: number;
      maxRetryAttempts?: number;
    };
    circuitBreaker?: {
      failureThreshold?: number;
      resetTimeout?: number;
    };
  };
  logging?: {
    level?: string;
    maxFileSize?: string;
    maxFiles?: number;
  };
  security?: {
    jwt?: {
      expiresIn?: string;
    };
    verification?: {
      codeExpiryMinutes?: number;
    };
  };
  features?: {
    aiEnhancedEmails?: boolean;
    emailQueue?: boolean;
    performanceMonitoring?: boolean;
    autoContext?: boolean;
  };
}

// 读取配置文件
const configPath = join(process.cwd(), 'config.json');
let fileConfig: FileConfig = {};
try {
  fileConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
} catch {
  console.warn('No config.json found, using defaults');
}

export type AIProvider = 'openai' | 'deepseek' | 'google' | 'anthropic' | 'azure-openai' | 'mock';

interface Config {
  email: {
    user: string;
    pass: string;
    name: string;
    smtp: {
      host: string;
      port: number;
      secure: boolean;
    };
    imap: {
      host: string;
      port: number;
      tls: boolean;
      rejectUnauthorized: boolean;
      checkIntervalMs: number;
    };
    forwarding: {
      enabled: boolean;
      markAsRead: boolean;
    };
    admin: {
      email: string;
    };
    startup: {
      notification: 'none' | 'admin' | 'all' | 'custom';
      customRecipients?: string[];
    };
  };
  ai: {
    provider: AIProvider;
    openai: {
      apiKey: string;
      model: string;
      baseURL?: string | undefined;
    };
    deepseek: {
      apiKey: string;
      model: string;
      baseURL: string;
    };
    google: {
      apiKey: string;
      model: string;
    };
    anthropic: {
      apiKey: string;
      model: string;
    };
    azureOpenai: {
      apiKey: string;
      endpoint: string;
      deploymentName: string;
      apiVersion: string;
    };
    mock: {
      enabled: boolean;
    };
  };
  schedule: {
    morningReminderTime: string;
    eveningReminderTime: string;
  };
  context: {
    maxLength: number;
    compressionThreshold: number;
  };
  logLevel: string;
}

const config: Config = {
  email: {
    // 敏感信息：仅从环境变量读取
    user: process.env.EMAIL_USER || process.env.SMTP_USER || '',
    pass: process.env.EMAIL_PASS || process.env.SMTP_PASS || '',
    name: process.env.USER_NAME || '',
    admin: {
      email: process.env.ADMIN_EMAIL || '',
    },
    
    // SMTP/IMAP配置：从环境变量读取
    smtp: {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
    },
    imap: {
      host: process.env.IMAP_HOST || 'imap.gmail.com',
      port: parseInt(process.env.IMAP_PORT || '993'),
      tls: process.env.IMAP_TLS !== 'false',
      rejectUnauthorized: process.env.IMAP_REJECT_UNAUTHORIZED !== 'false',
      checkIntervalMs: parseInt(process.env.EMAIL_CHECK_INTERVAL_MS || '30000'),
    },
    forwarding: {
      enabled: fileConfig.email?.forwarding?.enabled ?? true,
      markAsRead: fileConfig.email?.forwarding?.markAsRead ?? true,
    },
    startup: {
      notification: fileConfig.email?.startup?.notification || 'admin',
      ...(fileConfig.email?.startup?.customRecipients && {
        customRecipients: fileConfig.email?.startup?.customRecipients
      }),
    },
  },
  ai: {
    // 敏感信息：仅从环境变量读取
    provider: (process.env.AI_PROVIDER as AIProvider) || 'openai',
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      model: fileConfig.ai?.models?.openai || 'gpt-3.5-turbo',
      baseURL: process.env.OPENAI_BASE_URL,
    },
    deepseek: {
      apiKey: process.env.DEEPSEEK_API_KEY || '',
      model: fileConfig.ai?.models?.deepseek || 'deepseek-chat',
      baseURL: fileConfig.ai?.baseUrls?.deepseek || 'https://api.deepseek.com',
    },
    google: {
      apiKey: process.env.GOOGLE_API_KEY || '',
      model: fileConfig.ai?.models?.google || 'gemini-2.5-flash',
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY || '',
      model: fileConfig.ai?.models?.anthropic || 'claude-3-sonnet-20240229',
    },
    azureOpenai: {
      apiKey: process.env.AZURE_OPENAI_API_KEY || '',
      endpoint: process.env.AZURE_OPENAI_ENDPOINT || '',
      deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT || '',
      apiVersion: fileConfig.ai?.baseUrls?.azureOpenai?.apiVersion || '2023-12-01-preview',
    },
    mock: {
      enabled: process.env.NODE_ENV === 'test' || process.env.AI_PROVIDER === 'mock',
    },
  },
  schedule: {
    morningReminderTime: fileConfig.schedule?.morningReminderTime || '08:00',
    eveningReminderTime: fileConfig.schedule?.eveningReminderTime || '20:00',
  },
  context: {
    maxLength: fileConfig.context?.maxLength || 8000,
    compressionThreshold: fileConfig.context?.compressionThreshold || 6000,
  },
  logLevel: fileConfig.logging?.level || 'info',
};

// 配置验证函数
export function validateConfig(): void {
  const errors: string[] = [];
  
  // 动态读取当前环境变量而不是使用缓存的config对象
  const currentEnv = process.env;
  const isTestMode = currentEnv.NODE_ENV === 'test' || currentEnv.AI_PROVIDER === 'mock';

  // 验证邮件配置（测试模式下放宽要求）
  if (!isTestMode) {
    if (!(currentEnv.EMAIL_USER || currentEnv.SMTP_USER) || !(currentEnv.EMAIL_PASS || currentEnv.SMTP_PASS)) {
      errors.push('Email credentials (EMAIL_USER/SMTP_USER, EMAIL_PASS/SMTP_PASS) are required');
    }
    
    if (!currentEnv.ADMIN_EMAIL) {
      errors.push('Admin email (ADMIN_EMAIL) is required');
    }
  }

  // 验证AI配置
  const provider = currentEnv.AI_PROVIDER || 'openai';
  if (!isTestMode) {
    switch (provider) {
      case 'openai':
        if (!currentEnv.OPENAI_API_KEY) {
          errors.push('OpenAI API key (OPENAI_API_KEY) is required');
        }
        break;
      case 'deepseek':
        if (!currentEnv.DEEPSEEK_API_KEY) {
          errors.push('DeepSeek API key (DEEPSEEK_API_KEY) is required');
        }
        break;
      case 'google':
        if (!currentEnv.GOOGLE_API_KEY) {
          errors.push('Google API key (GOOGLE_API_KEY) is required');
        }
        break;
      case 'anthropic':
        if (!currentEnv.ANTHROPIC_API_KEY) {
          errors.push('Anthropic API key (ANTHROPIC_API_KEY) is required');
        }
        break;
      case 'azure-openai':
        if (!currentEnv.AZURE_OPENAI_API_KEY || !currentEnv.AZURE_OPENAI_ENDPOINT) {
          errors.push('Azure OpenAI credentials (AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT) are required');
        }
        break;
      case 'mock':
        // Mock provider doesn't need API keys
        break;
    }
  }

  // 安全检查
  if (currentEnv.IMAP_REJECT_UNAUTHORIZED === 'false') {
    console.warn('⚠️ IMAP SSL verification is disabled - security risk detected');
  }

  if (errors.length > 0) {
    throw createConfigError(
      `Configuration validation failed: ${errors.join('; ')}`,
      { 
        errors,
        provider,
        timestamp: new Date().toISOString()
      }
    );
  }
}

export default config;