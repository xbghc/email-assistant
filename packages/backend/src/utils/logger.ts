import winston from 'winston';
import config from '../config/index';

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

// 控制台输出配置
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    level: 'info', // 显示info级别及以上的信息
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.printf(({ level, message, timestamp }) => {
        const time = timestamp ? new Date(timestamp as string).toLocaleTimeString() : new Date().toLocaleTimeString();
        return `[${time}] ${level}: ${message}`;
      })
    )
  }));
} else {
  // 生产环境只显示警告和错误
  logger.add(new winston.transports.Console({
    level: 'warn',
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