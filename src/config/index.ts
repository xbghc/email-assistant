import dotenv from 'dotenv';

dotenv.config();

interface Config {
  email: {
    smtp: {
      host: string;
      port: number;
      user: string;
      pass: string;
    };
    user: {
      email: string;
      name: string;
    };
  };
  openai: {
    apiKey: string;
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
    user: {
      email: process.env.USER_EMAIL || '',
      name: process.env.USER_NAME || '',
    },
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
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

export default config;