import dotenv from 'dotenv';
import { createConfigError } from '../utils/errors';

dotenv.config();

export type AIProvider = 'openai' | 'deepseek' | 'google' | 'anthropic' | 'azure-openai' | 'mock';

interface Config {
  email: {
    smtp: {
      host: string;
      port: number;
      user: string;
      pass: string;
    };
    imap: {
      host: string;
      port: number;
      user: string;
      pass: string;
      tls: boolean;
      rejectUnauthorized: boolean;
      checkIntervalMs: number;
    };
    forwarding: {
      enabled: boolean;
      markAsRead: boolean;
    };
    user: {
      email: string;
      name: string;
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
    smtp: {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
    },
    imap: {
      host: process.env.IMAP_HOST || 'imap.gmail.com',
      port: parseInt(process.env.IMAP_PORT || '993'),
      user: process.env.IMAP_USER || process.env.SMTP_USER || '',
      pass: process.env.IMAP_PASS || process.env.SMTP_PASS || '',
      tls: process.env.IMAP_TLS === 'false' ? false : true,
      rejectUnauthorized: process.env.IMAP_REJECT_UNAUTHORIZED === 'false' ? false : true,
      checkIntervalMs: parseInt(process.env.EMAIL_CHECK_INTERVAL_MS || '30000'),
    },
    forwarding: {
      enabled: process.env.EMAIL_FORWARDING_ENABLED === 'false' ? false : true,
      markAsRead: process.env.EMAIL_FORWARDING_MARK_READ === 'false' ? false : true,
    },
    user: {
      email: process.env.USER_EMAIL || '',
      name: process.env.USER_NAME || '',
    },
  },
  ai: {
    provider: (process.env.AI_PROVIDER as AIProvider) || 'openai',
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
      baseURL: process.env.OPENAI_BASE_URL,
    },
    deepseek: {
      apiKey: process.env.DEEPSEEK_API_KEY || '',
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
    },
    google: {
      apiKey: process.env.GOOGLE_API_KEY || '',
      model: process.env.GOOGLE_MODEL || 'gemini-pro',
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY || '',
      model: process.env.ANTHROPIC_MODEL || 'claude-3-sonnet-20240229',
    },
    azureOpenai: {
      apiKey: process.env.AZURE_OPENAI_API_KEY || '',
      endpoint: process.env.AZURE_OPENAI_ENDPOINT || '',
      deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT || '',
      apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2023-12-01-preview',
    },
    mock: {
      enabled: process.env.NODE_ENV === 'test' || process.env.AI_PROVIDER === 'mock',
    },
  },
  schedule: {
    morningReminderTime: process.env.MORNING_REMINDER_TIME || '08:00',
    eveningReminderTime: process.env.EVENING_REMINDER_TIME || '20:00',
  },
  context: {
    maxLength: parseInt(process.env.MAX_CONTEXT_LENGTH || '8000'),
    compressionThreshold: parseInt(process.env.CONTEXT_COMPRESSION_THRESHOLD || '6000'),
  },
  logLevel: process.env.LOG_LEVEL || 'info',
};

// 配置验证函数
export function validateConfig(): void {
  const errors: string[] = [];
  
  // 动态读取当前环境变量而不是使用缓存的config对象
  const currentEnv = process.env;
  const isTestMode = currentEnv.NODE_ENV === 'test' || currentEnv.AI_PROVIDER === 'mock';

  // 验证邮件配置（测试模式下放宽要求）
  if (!isTestMode) {
    if (!currentEnv.SMTP_USER || !currentEnv.SMTP_PASS) {
      errors.push('SMTP credentials (SMTP_USER, SMTP_PASS) are required');
    }
    
    if (!currentEnv.USER_EMAIL) {
      errors.push('User email (USER_EMAIL) is required');
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