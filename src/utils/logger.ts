import winston from 'winston';
import config from '../config';

const logger = winston.createLogger({
  level: config.logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'email-assistant' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

// 简化控制台输出，只显示重要信息
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    level: 'warn', // 只显示警告和错误
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.printf(({ level, message, timestamp }) => {
        const time = timestamp ? new Date(timestamp as string).toLocaleTimeString() : new Date().toLocaleTimeString();
        return `[${time}] ${level}: ${message}`;
      })
    )
  }));
}

export default logger;