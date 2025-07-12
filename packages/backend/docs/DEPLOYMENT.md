# 🚀 部署指南

## 概述

本文档详细说明 Email Assistant 的生产环境部署流程和配置要求。

## 环境要求

### 系统要求
- **操作系统**: Linux (Ubuntu 20.04+ 推荐)
- **Node.js**: 20.11.0+
- **内存**: 最少 2GB，推荐 4GB+
- **存储**: 最少 10GB 可用空间
- **网络**: 稳定的互联网连接

### 软件依赖
- **PNPM**: 8.0+ (包管理器)
- **PM2**: 5.0+ (进程管理器，推荐)
- **Nginx**: 1.18+ (反向代理，可选)

## 部署流程

### 1. 服务器准备

#### 安装 Node.js
```bash
# 使用 NodeSource 仓库
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 验证安装
node --version
npm --version
```

#### 安装 PNPM
```bash
npm install -g pnpm
pnpm --version
```

#### 安装 PM2 (推荐)
```bash
npm install -g pm2
pm2 --version
```

### 2. 项目部署

#### 克隆项目
```bash
cd /opt
sudo git clone <repository-url> email-assistant
sudo chown -R $USER:$USER email-assistant
cd email-assistant
```

#### 安装依赖
```bash
pnpm install
```

#### 构建项目
```bash
pnpm build
```

### 3. 环境配置

#### 创建环境文件
```bash
cp .env.example .env
```

#### 配置环境变量
编辑 `.env` 文件：

```env
# 服务器配置
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# JWT 配置
JWT_SECRET=your-super-secure-jwt-secret-key-at-least-32-characters
JWT_EXPIRES_IN=7d

# 邮件配置 (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# 邮件配置 (IMAP)
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_USER=your-email@gmail.com
IMAP_PASS=your-app-password
IMAP_TLS=true

# 用户配置
USER_EMAIL=your-email@gmail.com
USER_NAME=Your Name

# AI 配置 (选择一个)
AI_PROVIDER=openai
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-3.5-turbo

# 系统配置
EMAIL_CHECK_INTERVAL_MS=30000
MORNING_REMINDER_TIME=08:00
EVENING_REMINDER_TIME=20:00

# CORS 配置
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

### 4. 启动服务

#### 使用 PM2 (推荐)
```bash
# 启动服务
pm2 start dist/index.js --name "email-assistant"

# 设置开机自启
pm2 startup
pm2 save

# 查看状态
pm2 status
pm2 logs email-assistant
```

#### 直接启动
```bash
cd /opt/email-assistant
pnpm start
```

## Nginx 配置 (可选)

### 安装 Nginx
```bash
sudo apt update
sudo apt install nginx
```

### 配置反向代理
创建 `/etc/nginx/sites-available/email-assistant`:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # 超时配置
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }

    # 静态文件缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 启用配置
```bash
sudo ln -s /etc/nginx/sites-available/email-assistant /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## SSL 证书配置

### 使用 Certbot (Let's Encrypt)
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

### 自动续期
```bash
sudo crontab -e
# 添加以下行
0 12 * * * /usr/bin/certbot renew --quiet
```

## 防火墙配置

### 使用 UFW
```bash
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw --force enable
```

### 使用脚本
项目提供了防火墙配置脚本：
```bash
chmod +x scripts/configure-firewall.sh
sudo ./scripts/configure-firewall.sh
```

## 监控和维护

### 系统监控
```bash
# 查看服务状态
pm2 status

# 查看日志
pm2 logs email-assistant

# 查看资源使用
pm2 monit

# 重启服务
pm2 restart email-assistant
```

### 健康检查
```bash
# 检查服务健康状态
curl http://localhost:3000/health

# 使用项目脚本
chmod +x scripts/health-check.sh
./scripts/health-check.sh
```

### 日志管理
```bash
# 查看应用日志
tail -f /opt/email-assistant/packages/backend/logs/combined.log

# 查看错误日志
tail -f /opt/email-assistant/packages/backend/logs/error.log

# 日志轮转 (PM2 自动处理)
pm2 flush email-assistant
```

## 备份策略

### 数据备份
```bash
# 创建备份脚本
sudo crontab -e
# 添加每日备份
0 2 * * * tar -czf /backup/email-assistant-$(date +\%Y\%m\%d).tar.gz /opt/email-assistant/packages/backend/data/
```

### 配置备份
```bash
# 备份环境配置
cp /opt/email-assistant/.env /backup/env-backup-$(date +%Y%m%d)
```

## 更新部署

### 应用更新
```bash
cd /opt/email-assistant

# 拉取最新代码
git pull origin main

# 安装依赖
pnpm install

# 构建项目
pnpm build

# 重启服务
pm2 restart email-assistant
```

### 滚动更新脚本
```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

## 性能优化

### PM2 配置
创建 `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'email-assistant',
    script: 'dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    max_memory_restart: '1G',
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true
  }]
};
```

启动集群：
```bash
pm2 start ecosystem.config.js
```

### 系统优化
```bash
# 增加文件描述符限制
echo "* soft nofile 65536" | sudo tee -a /etc/security/limits.conf
echo "* hard nofile 65536" | sudo tee -a /etc/security/limits.conf

# 优化内核参数
echo "net.core.somaxconn = 1024" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

## 安全配置

### 系统安全
```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 配置自动安全更新
sudo apt install unattended-upgrades
sudo dpkg-reconfigure unattended-upgrades
```

### 应用安全
- 定期更新依赖包
- 监控安全漏洞
- 使用强密码和密钥
- 限制文件权限

## 故障排除

### 常见问题

1. **服务无法启动**
   ```bash
   # 检查日志
   pm2 logs email-assistant
   # 检查环境变量
   pm2 env email-assistant
   ```

2. **邮件发送失败**
   ```bash
   # 测试邮件配置
   node scripts/debug-email-config.js
   ```

3. **内存使用过高**
   ```bash
   # 重启服务
   pm2 restart email-assistant
   # 检查内存泄漏
   pm2 monit
   ```

### 应急处理
```bash
# 紧急停止服务
pm2 stop email-assistant

# 紧急修复防火墙
chmod +x scripts/emergency-firewall-fix.sh
sudo ./scripts/emergency-firewall-fix.sh
```

---

**文档版本**: v1.0.0  
**最后更新**: 2025-07-12