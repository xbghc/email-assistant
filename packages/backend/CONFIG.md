# 配置文件说明

## 配置优先级

配置项按类型分别处理：

### 敏感信息配置

仅从环境变量读取（密码、API密钥、JWT密钥等）：

- 环境变量
- 默认值（空字符串或默认配置）

### 非敏感信息配置

优先从配置文件读取（服务器地址、端口、功能开关等）：

1. **config.json 文件配置** （最高优先级）
2. 代码中的默认值

## config.json 配置项说明

### 邮件配置 (email)

#### SMTP 发送配置 (email.smtp)

```json
{
  "email": {
    "smtp": {
      "host": "smtp.gmail.com", // SMTP 服务器地址
      "port": 587, // SMTP 端口号
      "secure": false // 是否使用 SSL/TLS
    }
  }
}
```

#### IMAP 接收配置 (email.imap)

```json
{
  "email": {
    "imap": {
      "host": "imap.gmail.com", // IMAP 服务器地址
      "port": 993, // IMAP 端口号
      "tls": true, // 是否启用 TLS
      "rejectUnauthorized": true, // 是否验证 SSL 证书
      "checkIntervalMs": 30000 // 邮件检查间隔（毫秒）
    }
  }
}
```

#### 邮件转发配置 (email.forwarding)

```json
{
  "email": {
    "forwarding": {
      "enabled": true, // 是否启用邮件转发
      "markAsRead": true // 转发后是否标记为已读
    }
  }
}
```

#### 系统启动通知配置 (email.startup)

```json
{
  "email": {
    "startup": {
      "notification": "admin", // 通知模式：none|admin|all|custom
      "customRecipients": ["custom1@email.com", "custom2@email.com"] // 自定义收件人列表（仅当 notification 为 custom 时有效）
    }
  }
}
```

**通知模式说明：**

- `none`: 不发送启动通知
- `admin`: 仅发送给管理员邮箱
- `all`: 发送给所有系统用户
- `custom`: 发送给指定的自定义邮箱列表

### AI 配置 (ai)

#### AI 提供商配置

```json
{
  "ai": {
    "provider": "openai", // AI 提供商：openai|deepseek|google|anthropic|azure-openai|mock
    "models": {
      "openai": "gpt-3.5-turbo",
      "deepseek": "deepseek-chat",
      "google": "gemini-pro",
      "anthropic": "claude-3-sonnet-20240229"
    },
    "baseUrls": {
      "deepseek": "https://api.deepseek.com",
      "azureOpenai": {
        "apiVersion": "2023-12-01-preview"
      }
    }
  }
}
```

### 日程配置 (schedule)

```json
{
  "schedule": {
    "morningReminderTime": "08:00", // 晨间提醒时间
    "eveningReminderTime": "20:00", // 晚间提醒时间
    "timezone": "Asia/Shanghai" // 时区设置
  }
}
```

### 上下文管理配置 (context)

```json
{
  "context": {
    "maxLength": 8000, // 上下文最大长度
    "compressionThreshold": 6000 // 触发压缩的阈值
  }
}
```

### 性能配置 (performance)

#### 邮件性能配置

```json
{
  "performance": {
    "email": {
      "connectionTimeout": 30000, // 连接超时时间（毫秒）
      "socketTimeout": 30000, // 套接字超时时间（毫秒）
      "maxConnections": 3, // 最大连接数
      "maxMessages": 10, // 每个连接的最大消息数
      "queueProcessInterval": 60000, // 队列处理间隔（毫秒）
      "maxRetryAttempts": 3 // 最大重试次数
    },
    "circuitBreaker": {
      "failureThreshold": 3, // 失败阈值
      "resetTimeout": 60000 // 重置超时时间（毫秒）
    }
  }
}
```

### 日志配置 (logging)

```json
{
  "logging": {
    "level": "info", // 日志级别：debug|info|warn|error
    "maxFileSize": "10MB", // 单个日志文件最大大小
    "maxFiles": 5 // 保留的日志文件数量
  }
}
```

### 安全配置 (security)

```json
{
  "security": {
    "jwt": {
      "expiresIn": "7d" // JWT 过期时间
    },
    "verification": {
      "codeExpiryMinutes": 30 // 验证码过期时间（分钟）
    }
  }
}
```

### 功能开关 (features)

```json
{
  "features": {
    "aiEnhancedEmails": true, // 是否启用 AI 增强邮件
    "emailQueue": true, // 是否启用邮件队列
    "performanceMonitoring": true, // 是否启用性能监控
    "autoContext": true // 是否启用自动上下文管理
  }
}
```

## 环境变量配置

以下敏感信息必须通过环境变量配置，不应放在 config.json 中：

### 必需的环境变量

```bash
# 邮件账户信息（敏感信息）
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
USER_NAME=Your Name
ADMIN_EMAIL=admin@example.com

# AI API 密钥（敏感信息）
OPENAI_API_KEY=sk-your-openai-key
DEEPSEEK_API_KEY=sk-your-deepseek-key
GOOGLE_API_KEY=your-google-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key

# JWT 密钥（敏感信息）
JWT_SECRET=your-very-long-and-secure-secret-key
```

### 可选的环境变量

```bash
# 其他可选配置
LOG_LEVEL=debug
NODE_ENV=production
```

## 配置示例

### 最小配置

```json
{
  "email": {
    "startup": {
      "notification": "admin"
    }
  },
  "ai": {
    "provider": "openai"
  }
}
```

### 完整配置示例

参考项目根目录下的 `config.json` 文件。

## 注意事项

1. **安全性**: 绝对不要在 `config.json` 中存储敏感信息（密码、API 密钥、JWT 密钥等）
2. **优先级**: `config.json` 中的配置会覆盖环境变量和默认值
3. **验证**: 启动时会自动验证配置的完整性和有效性
4. **重启**: 修改 `config.json` 后需要重启应用程序才能生效
