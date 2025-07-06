# 生产环境部署指南

## ⚠️ 当前状态：不建议直接上线

**安全风险评估：** 有多个关键安全问题需要修复

## 🔴 必须修复的安全问题

### 1. JWT密钥安全
```bash
# 设置强随机JWT密钥
export JWT_SECRET="$(openssl rand -base64 32)"
```

### 2. CORS配置
修改 `src/index.ts` 第14-23行：
```typescript
// 替换为安全的CORS配置
app.use(cors({
  origin: ['https://yourdomain.com', 'https://admin.yourdomain.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

### 3. 安全头部
添加安全中间件：
```bash
npm install helmet
```

```typescript
import helmet from 'helmet';
app.use(helmet());
```

## 🟡 建议修复的问题

### 1. 增强速率限制
修改认证路由的速率限制：
```typescript
// 登录端点：5次/15分钟
// 密码重置：3次/1小时
// 注册：3次/1小时
```

### 2. 密码策略强化
增加密码复杂度要求：
- 最少12字符
- 必须包含大小写字母、数字、特殊字符

### 3. 账户锁定机制
实现失败尝试后的账户锁定

## 📋 生产环境检查清单

### 环境配置
- [ ] 设置强JWT密钥 (`JWT_SECRET`)
- [ ] 配置正确的CORS域名
- [ ] 设置生产环境 (`NODE_ENV=production`)
- [ ] 配置日志级别 (`LOG_LEVEL=warn`)
- [ ] 设置正确的邮件凭据
- [ ] 配置AI服务API密钥

### 安全配置
- [ ] 禁用默认JWT密钥
- [ ] 配置安全头部 (helmet.js)
- [ ] 实现严格的速率限制
- [ ] 设置强密码策略
- [ ] 配置SSL/TLS证书

### 监控和日志
- [ ] 配置日志轮转
- [ ] 设置错误监控
- [ ] 配置健康检查
- [ ] 设置性能监控

### 备份和恢复
- [ ] 用户数据备份策略
- [ ] 配置文件备份
- [ ] 日志文件管理
- [ ] 恢复测试

## 🚀 部署步骤

### 1. 环境准备
```bash
# 创建生产环境配置
cp .env.production.example .env

# 编辑配置文件
nano .env
```

### 2. 安装依赖
```bash
npm ci --production
```

### 3. 构建应用
```bash
npm run build
```

### 4. 配置进程管理
```bash
# 使用 PM2
npm install -g pm2
pm2 start dist/index.js --name email-assistant

# 或使用 systemd
sudo systemctl enable email-assistant
sudo systemctl start email-assistant
```

### 5. 配置反向代理 (Nginx)
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 6. SSL证书配置
```bash
# 使用 Let's Encrypt
sudo certbot --nginx -d your-domain.com
```

## 📊 测试API端点

### 认证测试
```bash
# 系统初始化
curl -X POST https://your-domain.com/api/auth/init \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@yourdomain.com","password":"YourStrongPassword123!","name":"Admin"}'

# 用户登录
curl -X POST https://your-domain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@yourdomain.com","password":"YourStrongPassword123!"}'

# 健康检查
curl https://your-domain.com/health
```

## 🔧 维护指南

### 日志管理
```bash
# 查看应用日志
tail -f logs/combined.log

# 查看错误日志
tail -f logs/error.log
```

### 备份脚本
```bash
#!/bin/bash
# backup.sh
DATE=$(date +%Y%m%d_%H%M%S)
tar -czf backup_${DATE}.tar.gz users.json data/ logs/
```

### 更新流程
1. 停止服务
2. 备份数据
3. 更新代码
4. 重新构建
5. 重启服务
6. 验证功能

## 🚨 紧急情况处理

### 服务停止
```bash
# 重启服务
pm2 restart email-assistant

# 检查状态
pm2 status
pm2 logs email-assistant
```

### 数据恢复
```bash
# 从备份恢复
tar -xzf backup_YYYYMMDD_HHMMSS.tar.gz
```

## 📈 性能优化

### 内存监控
```bash
# 查看内存使用
ps aux | grep node
free -h
```

### 数据库优化
建议在用户量增长后迁移到数据库：
- PostgreSQL (推荐)
- MySQL
- MongoDB

## 🛡️ 安全建议

1. **定期更新**
   - 定期更新依赖包
   - 监控安全漏洞

2. **访问控制**
   - 限制管理界面访问
   - 使用VPN或IP白名单

3. **监控告警**
   - 设置异常登录告警
   - 监控API调用频率
   - 关键操作日志审计

4. **数据保护**
   - 加密敏感数据
   - 定期清理过期日志
   - 备份数据加密

## 🎯 生产就绪评估

当前状态：**60% 就绪**

### 已完成 ✅
- 基础功能实现
- 错误处理机制
- 日志记录系统
- API接口完整
- 基础数据验证

### 需要修复 ⚠️
- JWT密钥安全问题
- CORS配置漏洞
- 缺少安全头部
- 速率限制不足
- 密码策略较弱

### 预计修复时间
- 关键安全问题：1-2天
- 全部优化完成：1-2周

修复这些问题后，系统可以安全上线运行。