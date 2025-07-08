# 生产环境部署指南

## 🚨 重要：清理Mock数据

在部署到生产环境之前，必须清理所有测试和mock数据。

### 1. 运行生产就绪检查

```bash
./scripts/check-production-ready.sh
```

### 2. 清理Mock数据

#### ✅ 已清理的内容
- `users.json` - 示例用户数据已清空
- `data/context.json` - 示例工作总结已清空
- Web界面mock数据已替换为真实API调用

#### ⚠️ 仍需配置的内容

1. **环境变量配置**
```bash
# 复制生产配置模板
cp .env.production.example .env

# 编辑配置文件
nano .env
```

2. **必须修改的配置**
```bash
# 基本配置
NODE_ENV=production
LOG_LEVEL=warn

# AI服务 (选择一个真实的AI服务商)
AI_PROVIDER=openai  # 不要使用 'mock'
OPENAI_API_KEY=sk-your-real-api-key

# 邮件服务 (使用真实的SMTP服务器)
SMTP_HOST=smtp.gmail.com  # 不要使用 'localhost'
SMTP_USER=your-email@gmail.com  # 不要使用 'test@example.com'
SMTP_PASS=your-app-password
USER_EMAIL=your-email@gmail.com
USER_NAME=Your Real Name

# 安全配置
JWT_SECRET=$(openssl rand -base64 32)  # 生成强密码
```

### 3. Mock服务说明

#### MockAIService (`src/services/mockAIService.ts`)
- **保留原因**: 用于开发和测试环境
- **生产配置**: 确保 `AI_PROVIDER` 不是 'mock'
- **支持的真实AI服务**: OpenAI, DeepSeek, Google Gemini, Anthropic Claude, Azure OpenAI

#### 开发环境认证绕过 (`src/middleware/authMiddleware.ts`)
- **保留原因**: 便于本地开发
- **生产配置**: 在生产环境中 `NODE_ENV=production` 会自动禁用绕过
- **安全性**: 只在localhost和开发环境中有效

### 4. 验证配置

部署前运行检查：
```bash
# 设置环境变量后再次检查
source .env
./scripts/check-production-ready.sh
```

### 5. 数据文件状态

#### 已清理
- ✅ `users.json`: 空数组 `[]`
- ✅ `data/context.json`: 空上下文 `{"admin": []}`

#### 生产数据
真实用户数据将通过以下方式创建：
- 用户注册API (`/api/auth/register`)
- 管理员添加用户功能
- 邮件交互自动创建工作总结

### 6. Web管理界面

#### 已实现的真实数据连接
- ✅ **仪表板**: 真实用户统计、邮件发送数、系统运行时间
- ✅ **用户管理**: 真实用户数据API连接
- ✅ **系统状态**: 真实系统健康检查数据
- ✅ **报告管理**: 基于真实邮件统计生成的报告
- ✅ **日志查看**: 真实系统日志API连接
- ✅ **系统配置**: 真实配置数据显示

#### 错误处理
- 详细的错误信息显示
- 网络失败时的降级处理
- 友好的用户反馈

### 7. 部署清单

在生产部署前确认：

- [ ] 运行 `./scripts/check-production-ready.sh` 通过所有检查
- [ ] `AI_PROVIDER` 不是 'mock'
- [ ] 邮件配置使用真实SMTP服务器
- [ ] JWT_SECRET 是强随机密码
- [ ] NODE_ENV=production
- [ ] 用户数据文件已清空
- [ ] 上下文数据文件已清空
- [ ] 测试邮件发送功能
- [ ] 测试用户注册功能
- [ ] 验证Web管理界面正常工作

### 8. 首次部署后

1. **创建管理员用户**
```bash
curl -X POST http://your-domain.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@yourdomain.com",
    "password": "your-secure-password",
    "name": "Administrator"
  }'
```

2. **访问Web管理界面**
```
http://your-domain.com
```

3. **测试提醒功能**
```bash
curl -X POST http://your-domain.com/test/morning-reminder
curl -X POST http://your-domain.com/test/evening-reminder
```

## 🔐 安全注意事项

1. **不要在生产环境中使用**:
   - `AI_PROVIDER=mock`
   - `test@example.com` 邮箱
   - `localhost` SMTP服务器
   - 默认JWT密钥

2. **定期更新**:
   - JWT密钥
   - 邮件服务密码
   - API密钥

3. **监控**:
   - 检查日志中的错误
   - 监控邮件发送状态
   - 验证用户注册功能

---

✅ **系统现状**: Mock数据已清理，Web界面已连接真实API，只需配置环境变量即可投入生产使用。