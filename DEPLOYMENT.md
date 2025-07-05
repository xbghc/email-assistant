# 邮件助手系统 - 部署指南

## 🚀 快速部署

### 前置要求
- Node.js >= 18.0.0
- npm >= 8.0.0
- Git

### 部署步骤

1. **克隆项目**
   ```bash
   git clone <your-repository-url>
   cd email-assistant
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **配置环境变量**
   ```bash
   cp .env.example .env
   # 编辑 .env 文件，填入你的配置信息
   ```

4. **编译项目**
   ```bash
   npm run build
   ```

5. **启动服务**
   ```bash
   npm start
   ```

6. **访问系统**
   - Web管理界面: http://localhost:3000
   - API健康检查: http://localhost:3000/health

## ⚙️ 配置说明

### 基础配置 (.env)

```bash
# 基本应用配置
PORT=3000
NODE_ENV=production
LOG_LEVEL=warn

# 邮件服务配置
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_USER=your-email@gmail.com
IMAP_PASS=your-app-password

# 用户信息
EMAIL_USER=your-email@gmail.com
USER_NAME=Your Name

# AI服务配置 (选择一个)
AI_PROVIDER=openai
OPENAI_API_KEY=sk-your-openai-api-key
OPENAI_MODEL=gpt-3.5-turbo
```

### AI提供商配置

#### OpenAI
```bash
AI_PROVIDER=openai
OPENAI_API_KEY=sk-your-openai-api-key
OPENAI_MODEL=gpt-3.5-turbo
```

#### DeepSeek
```bash
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=sk-your-deepseek-api-key
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

#### Google Gemini
```bash
AI_PROVIDER=google
GOOGLE_API_KEY=your-google-api-key
GOOGLE_MODEL=gemini-pro
```

#### Anthropic Claude
```bash
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-your-anthropic-api-key
ANTHROPIC_MODEL=claude-3-haiku-20240307
```

#### Azure OpenAI
```bash
AI_PROVIDER=azure-openai
AZURE_OPENAI_API_KEY=your-azure-api-key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-35-turbo
AZURE_OPENAI_API_VERSION=2024-02-15-preview
```

### 测试模式配置

如果暂时没有邮件和AI配置，可以使用测试模式：

```bash
NODE_ENV=test
AI_PROVIDER=mock
```

## 🔧 高级配置

### 定时任务配置
```bash
MORNING_REMINDER_TIME=09:00
EVENING_REMINDER_TIME=18:00
```

### 邮件转发配置
```bash
EMAIL_FORWARDING_ENABLED=false
EMAIL_FORWARDING_MARK_AS_READ=true
```

### 上下文管理配置
```bash
MAX_CONTEXT_LENGTH=8000
CONTEXT_COMPRESSION_THRESHOLD=6000
```

## 🐳 Docker 部署 (可选)

创建 `Dockerfile`:
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

构建和运行:
```bash
docker build -t email-assistant .
docker run -d -p 3000:3000 --env-file .env email-assistant
```

## 🔒 安全建议

1. **环境变量保护**
   - 不要将 .env 文件提交到版本控制
   - 使用强密码和API密钥
   - 定期轮换密钥

2. **网络安全**
   - 使用 HTTPS (推荐使用反向代理如 Nginx)
   - 配置防火墙规则
   - 限制API访问频率

3. **生产环境配置**
   ```bash
   NODE_ENV=production
   LOG_LEVEL=warn
   ```

## 📊 监控和维护

### 健康检查
```bash
curl http://localhost:3000/health
```

### 日志查看
```bash
# 查看应用日志
tail -f logs/combined.log

# 查看错误日志
tail -f logs/error.log
```

### 性能监控
- CPU使用率: 通过 Web界面 -> 系统状态
- 内存使用: 通过 Web界面 -> 系统状态
- API响应时间: 通过健康检查端点

## 🔄 系统维护

### 重启服务
```bash
# 使用 PM2 (推荐)
pm2 restart email-assistant

# 或直接重启
npm restart
```

### 清理日志
```bash
# 清理旧日志 (保留最近7天)
find logs/ -name "*.log" -mtime +7 -delete
```

### 备份数据
```bash
# 备份用户数据和上下文
cp users.json backup/users_$(date +%Y%m%d).json
cp data/context.json backup/context_$(date +%Y%m%d).json
```

## 🛠️ 故障排查

### 常见问题

1. **邮件发送失败**
   - 检查 SMTP 配置
   - 确认邮件服务商支持应用密码
   - 查看错误日志

2. **AI服务不可用**
   - 检查 API 密钥是否正确
   - 确认网络连接
   - 可临时切换到 mock 模式

3. **Web界面无法访问**
   - 检查端口是否被占用
   - 确认静态文件编译成功
   - 检查防火墙设置

### 诊断命令
```bash
# 检查服务状态
npm run validate

# 运行完整测试
node final-system-check.js

# 测试特定功能
node test-weekly-report.js
node test-personalization.js
node test-web-interface.js
```

## 📈 性能优化

### 生产环境优化
1. 启用 gzip 压缩
2. 使用 CDN 加速静态资源
3. 配置适当的缓存策略
4. 使用进程管理器 (PM2)

### PM2 配置示例
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'email-assistant',
    script: 'dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
```

## 📞 支持

如有问题，请检查：
1. 日志文件 (`logs/` 目录)
2. 系统状态页面
3. API健康检查端点
4. 运行完整系统检查

---

🎉 **恭喜！** 您的邮件助手系统已准备就绪。开始享受智能工作助手带来的便利吧！